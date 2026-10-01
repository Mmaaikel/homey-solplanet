import { Inverter } from "../../lib/inverter.js";
import SolPlanetApi from "../../lib/SolPlanetApi.js";
import SolPlanetClient from "../../lib/SolPlanetClient.js";

class HybridSolar extends Inverter {

	checksFailed = 0;
	interval = 60;
	api;

	async onInit() {
		this.homey.log('HybridSolar has been initialized')

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
				'meter_power.solar_total',
				'measure_power.inverter',
				'measure_power.dongle_pv',
				'measure_power.mppt1',
				'measure_power.mppt2',
				'measure_power.mppt3',
				'measure_power.phase1',
				'measure_power.phase2',
				'measure_power.phase3',
				'measure_voltage.phase1',
				'measure_voltage.phase2',
				'measure_voltage.phase3',
				'measure_current.phase1',
				'measure_current.phase2',
				'measure_current.phase3',
			];
			for( const capabilityId of createCapabilities ) {
				if( !this.hasCapability(capabilityId) ) {
					await this.addCapability(capabilityId);
					this.homey.log(`Added ${ capabilityId } capability`);
				}
			}

			const removeCapabilities = ['meter_power', 'meter_power.total'];
			for( const capabilityId of removeCapabilities ) {
				if( this.hasCapability(capabilityId) ) {
					await this.removeCapability(capabilityId);
					this.homey.log(`Removed ${ capabilityId } capability`);
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
					solplanet_version_label: primaryInverter.cmv,
				})

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

				const inverterInfo = await this.api.getInverterInfo();
				if( inverterInfo !== null ) {

					const primaryInverter = inverterInfo.getPrimaryInverter();
					let inverterData = null;
					try {
						inverterData = await this.api.getInverterData();
						if (inverterData !== null) {
							// Inverter AC output includes power supplied by the battery.
							const inverterPower = this.parseApiNumber(inverterData.pac, {
								invalidValues: [0xFFFFFFFF],
							});
							this.homey.log( `Inverter AC output is: ${ inverterPower }W` );

							if( inverterPower !== null ) {
								this.setValueWithCatch('measure_power.inverter', inverterPower);
							}

							const inverterTemperature = this.parseApiNumber(inverterData.tmp, {
								divisor: 10,
								invalidValues: [-32768],
							});
							if( inverterTemperature !== null ) {
								this.setValueWithCatch('measure_temperature', inverterTemperature);
							}

							this.updateInverterDiagnostics(inverterData);

							const pvPower = this.calculatePvPower(inverterData);
							this.homey.log( `Calculated PV array power is: ${ pvPower }W` );
							if( pvPower !== null ) {
								this.updateSolarPower(pvPower);
							} else if( inverterPower === 0 ) {
								this.updateSolarPower(0);
							}

							this.updateFaultState('inverter', {
								error: inverterData.err,
								warning: inverterData.wan,
							}, 'hybrid_inverter_fault', 'inverter');
						}
					} catch (err) {
						this.homey.log("Error fetching inverter data:", err.message);
					}

					if( inverterData === null ) {
						const inverterPower = this.parseApiNumber(primaryInverter.pac, {
							invalidValues: [0xFFFFFFFF],
						});
						if( inverterPower !== null ) {
							this.setValueWithCatch('measure_power.inverter', inverterPower);
						}
						if( inverterPower === 0 ) {
							this.updateSolarPower(0);
						}
					}

					const solarEnergyTodayRaw = inverterData?.etd ?? primaryInverter.etd;
					const solarEnergyTodayValue = this.parseApiNumber(solarEnergyTodayRaw, {
						divisor: 10,
						invalidValues: [0xFFFFFFFF],
					});
					if( solarEnergyTodayValue !== null ) {
						const solarEnergyToday = Math.abs(solarEnergyTodayValue);
						this.homey.log( `Solar energy today is: ${ solarEnergyToday }kWh` );
						this.setValueWithCatch('meter_power.solar_today', solarEnergyToday);
					}

					const solarEnergyTotalRaw = inverterData?.eto ?? primaryInverter.eto;
					const solarEnergyTotalValue = this.parseApiNumber(solarEnergyTotalRaw, {
						divisor: 10,
						invalidValues: [0xFFFFFFFF],
					});
					if( solarEnergyTotalValue !== null ) {
						const solarEnergyTotal = Math.abs(solarEnergyTotalValue);
						this.homey.log( `Solar energy total is: ${ solarEnergyTotal }kWh` );
						this.setValueWithCatch('meter_power.solar_total', solarEnergyTotal);
					}

					// Reset the checks failed
					if( this.checksFailed > 0 ) {
						this.checksFailed = 0;
						this.setDefaultInterval()
					}

					// Get battery diagnostics and the firmware-specific ppv value.
					if( primaryInverter.hasBatteryStorage() ) {
						await this.updateBatteryDiagnostics();
					}

					// Get meter data for grid power
					await this.updateMeterData();
					this.updateConnectionState(true, 'hybrid_device_online', 'hybrid_device_offline');

					this.setAvailable().catch( this.onError.bind( this ) );
				}
			} catch (err) {
				this.onError( err );

				if( await this.isHomeyLocalHourBetween(0, 3) ) {
					this.setCapabilityValue( "meter_power.solar_today", 0 ).catch( this.onError.bind( this ) );
					this.setCapabilityValue( "meter_power.grid_import_today", 0 ).catch( this.onError.bind( this ) );
					this.setCapabilityValue( "meter_power.grid_export_today", 0 ).catch( this.onError.bind( this ) );
				}

				if( this.checksFailed > 3 ) {
					this.updateConnectionState(false, 'hybrid_device_online', 'hybrid_device_offline');
					this.resetInterval( 5 * 60 );
					this.setValueWithCatch('measure_power', 0 );
					this.setValueWithCatch('measure_power.inverter', 0 );
					this.setValueWithCatch('measure_power.dongle_pv', 0 );
					this.setValueWithCatch('measure_power.grid', 0 );
				}
			}
		} else if ( !this.api ) {
			this.homey.log("SolPlanet could not be discovered on your network")

			await this.setUnavailable(
				"SolPlanet could not be discovered on your network"
			);
		}
	}

	updateSolarPower(solarPower) {
		const result = this.setValueWithCatch('measure_power', solarPower);
		this.emitNumericFlowCards(result, {
			risesAboveCard: 'hybrid_solar_power_rises_above',
			dropsBelowCard: 'hybrid_solar_power_drops_below',
			tokenName: 'power',
		});
		this.updateProducingState('solar', solarPower, 'hybrid_solar_production_started', 'hybrid_solar_production_stopped');
	}

	async updateBatteryDiagnostics() {
		try {
			const batteryData = await this.api.getBatteryData();

			if( batteryData !== null ) {
				// Some hybrid firmware reports export-like power in ppv. Keep it as a
				// diagnostic value instead of using it for Homey solar production.
				const donglePvPower = this.parseApiNumber(batteryData.ppv, {
					invalidValues: [0xFFFFFFFF],
				});
				this.homey.log( `Dongle reported PV power is: ${ donglePvPower }W` );

				if( donglePvPower !== null ) {
					this.setValueWithCatch('measure_power.dongle_pv', donglePvPower);
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
				}, 'hybrid_inverter_fault', 'battery');
			}
		} catch (err) {
			this.homey.log("Error fetching battery/solar data:", err.message);
		}
	}

	async updateMeterData() {
		try {
			const meterData = await this.api.getMeterData();

			if( meterData !== null ) {
				// Grid power (W) - positive is import, negative is export
				const gridPower = this.parseApiNumber(meterData.pac, {
					invalidValues: [-2147483648, 0xFFFFFFFF],
				});
				this.homey.log( `Grid power is: ${ gridPower }W` );

				if( gridPower !== null ) {
					const result = this.setValueWithCatch("measure_power.grid", gridPower);
					const previous = Number(result.oldValue);
					if (Number.isFinite(previous) && result.isChanged) {
						this.emitNumericFlowCards({
							oldValue: Math.max(previous, 0),
							newValue: Math.max(gridPower, 0),
							isChanged: Math.max(previous, 0) !== Math.max(gridPower, 0),
						}, {
							risesAboveCard: 'hybrid_grid_import_rises_above',
							tokenName: 'power',
						});
						this.emitNumericFlowCards({
							oldValue: Math.max(-previous, 0),
							newValue: Math.max(-gridPower, 0),
							isChanged: Math.max(-previous, 0) !== Math.max(-gridPower, 0),
						}, {
							risesAboveCard: 'hybrid_grid_export_rises_above',
							tokenName: 'power',
						});
					}
					this.updateDirectionalPowerState('grid', gridPower, {
						positive: 'hybrid_grid_started_importing',
						negative: 'hybrid_grid_started_exporting',
						idle: 'hybrid_grid_became_idle',
					});
				}

				// Grid import today (kWh) - itd is in 0.01 kWh
				const gridImportTodayValue = this.parseApiNumber(meterData.itd, {
					divisor: 100,
					invalidValues: [0xFFFFFFFF],
				});
				const gridImportToday = gridImportTodayValue === null ? null : Math.abs(gridImportTodayValue);
				this.homey.log( `Grid import today is: ${ gridImportToday }kWh` );

				if( gridImportToday !== null ) {
					this.setValueWithCatch("meter_power.grid_import_today", gridImportToday);
				}

				// Grid export today (kWh) - otd is in 0.01 kWh
				const gridExportTodayValue = this.parseApiNumber(meterData.otd, {
					divisor: 100,
					invalidValues: [0xFFFFFFFF],
				});
				const gridExportToday = gridExportTodayValue === null ? null : Math.abs(gridExportTodayValue);
				this.homey.log( `Grid export today is: ${ gridExportToday }kWh` );

				if( gridExportToday !== null ) {
					this.setValueWithCatch("meter_power.grid_export_today", gridExportToday);
				}

				// Grid import total (kWh) - iet is in 0.1 kWh
				const gridImportTotalValue = this.parseApiNumber(meterData.iet, {
					divisor: 10,
					invalidValues: [0xFFFFFFFF],
				});
				const gridImportTotal = gridImportTotalValue === null ? null : Math.abs(gridImportTotalValue);
				this.homey.log( `Grid import total is: ${ gridImportTotal }kWh` );

				if( gridImportTotal !== null ) {
					this.setValueWithCatch("meter_power.grid_import_total", gridImportTotal);
				}

				// Grid export total (kWh) - oet is in 0.1 kWh
				const gridExportTotalValue = this.parseApiNumber(meterData.oet, {
					divisor: 10,
					invalidValues: [0xFFFFFFFF],
				});
				const gridExportTotal = gridExportTotalValue === null ? null : Math.abs(gridExportTotalValue);
				this.homey.log( `Grid export total is: ${ gridExportTotal }kWh` );

				if( gridExportTotal !== null ) {
					this.setValueWithCatch("meter_power.grid_export_total", gridExportTotal);
				}
			}
		} catch (err) {
			this.homey.log("Error fetching meter data:", err.message);
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

export default HybridSolar;
