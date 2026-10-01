import { Inverter } from "../../lib/inverter.js";
import SolPlanetApi from "../../lib/SolPlanetApi.js";
import SolPlanetClient from "../../lib/SolPlanetClient.js";

class HybridBattery extends Inverter {

	checksFailed = 0;
	interval = 60;
	api;

	async onInit() {
		this.homey.log('HybridBattery has been initialized')

		const settings = this.getSettings();
		this.homey.log( 'Settings:', settings )

		// Init the API
		const solPlanetClient = new SolPlanetClient( settings.ip_address, settings.device_serial_number );
		this.api = new SolPlanetApi( solPlanetClient );

		this.homey.log('Api created', this.api );

		this.setDefaultInterval()

		super.onInit();

		try {
			const createCapabilities = [
				'battery_soc.health',
				'measure_temperature',
				'measure_voltage',
				'measure_current',
				'measure_current.charge_limit',
				'measure_current.discharge_limit',
				'measure_power.eps',
				'meter_power.imported',
				'meter_power.exported',
				'meter_power.eps_today',
				'meter_power.eps_total',
			];
			for( const capabilityId of createCapabilities ) {
				if( !this.hasCapability(capabilityId) ) {
					await this.addCapability(capabilityId);
					this.homey.log(`Added ${ capabilityId } capability`);
				}
			}
		} catch (err) {
			this.homey.log(`Could not migrate device capabilities: ${ err.message }`);
		}

		try {
			const inverterInfo = await this.api.getInverterInfo();
			if( inverterInfo !== null ) {

				const primaryInverter = inverterInfo.getPrimaryInverter();

				await this.setSettings({
					solplanet_model_label: primaryInverter.model,
				})

				if( primaryInverter.hasBatteryStorage() ) {
					const batteryInfo = await this.api.getBatteryInfo();
					if( batteryInfo !== null ) {
						this.homey.log("Battery info fetched", batteryInfo );

						await this.setSettings({
							solplanet_battery_model_label: batteryInfo.battery?.manufactoty ?? 'Unknown',
						})

						const batteryInfoCapacity = batteryInfo.battery?.capacity ?? 'Unknown';
						await this.setSettings({
							solplanet_battery_info_capacity: batteryInfoCapacity,
						});
					}
				}
			}
		} catch (err) {
			this.homey.log(`Inverter unavailable during initialization; keeping cached values: ${ err.message }`);
		}

		await this.setAvailable();
	}

	setDefaultInterval() {
		const settings = this.getSettings();

		this.interval = settings.interval ?? 60;
		this.resetInterval( this.interval );
	}

	async onSettings({ newSettings = {}, changedKeys = [] } = {}) {
		const settings = {
			...this.getSettings(),
			...newSettings,
		};

		// Init the API with new settings
		const solPlanetClient = new SolPlanetClient( settings.ip_address, settings.device_serial_number );
		const newApi = new SolPlanetApi( solPlanetClient );

		// Validate
		const inverterInfo = await newApi.getInverterInfo();
		if( inverterInfo === null || inverterInfo.getPrimaryInverter() === null ) {
			throw new Error(
				`Could not fetch the correct data. Check the settings.`
			);
		}

		// Overwrite
		this.api = newApi;

		// Force production check when settings are changed
		this.checkProduction().catch( this.onError.bind( this ) );

		if( changedKeys.includes("interval") && settings.interval ) {
			this.interval = settings.interval;
			this.resetInterval( this.interval );
			this.homey.log(`Changed interval to ${ this.interval }`);
		}
	}

	async checkProduction() {
		this.homey.log("Checking production");

		if( this.api ) {
			try {

				const batteryData = await this.api.getBatteryData();

				if( batteryData !== null ) {
					this.updateConnectionState(true, 'battery_device_online', 'battery_device_offline');

					// Reset the checks failed
					if( this.checksFailed > 0 ) {
						this.checksFailed = 0;
						this.setDefaultInterval()
					}

					// Battery power (W) - positive=charging, negative=discharging (matches Homey convention)
					const batteryPower = this.parseApiNumber(batteryData.pb, {
						invalidValues: [-2147483648, 0xFFFFFFFF],
					});
					this.homey.log( `Battery power is: ${ batteryPower }W` );

					if( batteryPower !== null ) {
						this.setValueWithCatch("measure_power", batteryPower);
						this.updateDirectionalPowerState('battery', batteryPower, {
							positive: 'battery_started_charging',
							negative: 'battery_started_discharging',
							idle: 'battery_became_idle',
						});
					}

					// Battery SOC (%)
					const batterySoc = this.parseApiNumber(batteryData.soc, {
						invalidValues: [0xFFFF],
					});
					this.homey.log( `Battery SOC is: ${ batterySoc }%` );

					if( batterySoc !== null && batterySoc >= 0 && batterySoc <= 100 ) {
						const resultBatterySoc = this.setValueWithCatch("battery_soc", batterySoc);

						this.emitNumericFlowCards(resultBatterySoc, {
							changedCard: 'battery_percentage_changed',
							risesAboveCard: 'battery_rises_above',
							dropsBelowCard: 'battery_drops_below',
							tokenName: 'battery_percentage',
						});
					}

					this.batteryStateOfHealth = this.parseApiNumber(batteryData.soh, {
						invalidValues: [0xFFFF],
					});
					if( this.batteryStateOfHealth !== null && this.batteryStateOfHealth >= 0 && this.batteryStateOfHealth <= 100 ) {
						this.setValueWithCatch('battery_soc.health', this.batteryStateOfHealth);
					}

					const batteryTemperature = this.parseApiNumber(batteryData.tb, {
						divisor: 10,
						invalidValues: [-32768],
					});
					if( batteryTemperature !== null ) {
						this.setValueWithCatch('measure_temperature', batteryTemperature);
					}

					const batteryVoltage = this.parseApiNumber(batteryData.vb, {
						divisor: 100,
						invalidValues: [0xFFFFFFFF],
					});
					if( batteryVoltage !== null ) {
						this.setValueWithCatch('measure_voltage', batteryVoltage);
					}

					const batteryCurrent = this.parseApiNumber(batteryData.cb, {
						divisor: 10,
						invalidValues: [-2147483648, -32768, 0xFFFFFFFF],
					});
					if( batteryCurrent !== null ) {
						this.setValueWithCatch('measure_current', batteryCurrent);
					}

					const chargeCurrentLimit = this.parseApiNumber(batteryData.cli, {
						divisor: 10,
						invalidValues: [0xFFFF],
					});
					if( chargeCurrentLimit !== null ) {
						this.setValueWithCatch('measure_current.charge_limit', chargeCurrentLimit);
					}

					const dischargeCurrentLimit = this.parseApiNumber(batteryData.clo, {
						divisor: 10,
						invalidValues: [0xFFFF],
					});
					if( dischargeCurrentLimit !== null ) {
						this.setValueWithCatch('measure_current.discharge_limit', dischargeCurrentLimit);
					}

					this.updateActiveLowFaultState('battery', {
						error1: batteryData.eb1,
						error2: batteryData.eb2,
						error3: batteryData.eb3,
						error4: batteryData.eb4,
						warning1: batteryData.wb1,
						warning2: batteryData.wb2,
						warning3: batteryData.wb3,
						warning4: batteryData.wb4,
					}, 'battery_fault', 'battery');

					// Battery charge today (kWh) - ebi is in 0.1 kWh
					const batteryChargeValue = this.parseApiNumber(batteryData.ebi, {
						divisor: 10,
						invalidValues: [0xFFFFFFFF],
					});
					const batteryChargeToday = batteryChargeValue === null ? null : Math.abs(batteryChargeValue);
					this.homey.log( `Battery charge today is: ${ batteryChargeToday }kWh` );

					if( batteryChargeToday !== null ) {
						this.setValueWithCatch("meter_power.battery_charge_today", batteryChargeToday);
						this.setValueWithCatch('meter_power.imported', batteryChargeToday);
					}

					// Battery discharge today (kWh) - ebo is in 0.1 kWh
					const batteryDischargeValue = this.parseApiNumber(batteryData.ebo, {
						divisor: 10,
						invalidValues: [0xFFFFFFFF],
					});
					const batteryDischargeToday = batteryDischargeValue === null ? null : Math.abs(batteryDischargeValue);
					this.homey.log( `Battery discharge today is: ${ batteryDischargeToday }kWh` );

					if( batteryDischargeToday !== null ) {
						this.setValueWithCatch("meter_power.battery_discharge_today", batteryDischargeToday);
						this.setValueWithCatch('meter_power.exported', batteryDischargeToday);
					}

					const epsPower = this.parseApiNumber(batteryData.pesp, {
						invalidValues: [0xFFFFFFFF],
					});
					if( epsPower !== null ) {
						this.setValueWithCatch('measure_power.eps', epsPower);
					}

					const epsEnergyToday = this.parseApiNumber(batteryData.etdesp, {
						divisor: 10,
						invalidValues: [0xFFFFFFFF],
					});
					if( epsEnergyToday !== null ) {
						this.setValueWithCatch('meter_power.eps_today', Math.abs(epsEnergyToday));
					}

					const epsEnergyTotal = this.parseApiNumber(batteryData.etoesp, {
						divisor: 10,
						invalidValues: [0xFFFFFFFF],
					});
					if( epsEnergyTotal !== null ) {
						this.setValueWithCatch('meter_power.eps_total', Math.abs(epsEnergyTotal));
					}

					this.setAvailable().catch( this.onError.bind( this ) );
				}
			} catch (err) {
				this.onError( err );

				if( this.checksFailed > 3 ) {
					this.updateConnectionState(false, 'battery_device_online', 'battery_device_offline');
					this.resetInterval( 5 * 60 );
					this.setValueWithCatch('measure_power', 0 );
				}
			}
		} else if ( !this.api ) {
			this.homey.log("SolPlanet could not be discovered on your network")

			await this.setUnavailable(
				"SolPlanet could not be discovered on your network"
			);
		}
	}

	onError (error) {
		const errorMessage = error.message;

		if( errorMessage.toLowerCase().includes('not found') ) {
			this.homey.log('Device could not be found. Stop the interval');
			this.stopInterval()
			return
		}

		this.checksFailed++;
		this.homey.log(`Unavailable (${this.checksFailed}): ${errorMessage}`);
	}
}

export default HybridBattery;
