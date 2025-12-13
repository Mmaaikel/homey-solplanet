import { Inverter } from "../../inverter";
import SolPlanetApi from "../solplanet/library/SolPlanetApi.js";
import SolPlanetClient from "../solplanet/library/SolPlanetClient.js";
import _ from 'lodash'

class InverterWithBattery extends Inverter {

	checksFailed = 0;
	interval = 60;
	api;

	async onInit() {
		this.homey.log('InverterWithBattery has been initialized')

		const settings = this.getSettings();
		this.homey.log( 'Settings:', settings )

		// Init the API
		const solPlanetClient = new SolPlanetClient( settings.ip_address, settings.device_serial_number );
		this.api = new SolPlanetApi( solPlanetClient );

		this.homey.log('Api created', this.api );

		this.setDefaultInterval()

		super.onInit();

		// Set some info labels
		const inverterInfo = await this.api.getInverterInfo();
		if( inverterInfo !== null ) {

			const primaryInverter = inverterInfo.getPrimaryInverter();

			this.setSettings({
				solplanet_model_label: primaryInverter.model,
				solplanet_version_label: primaryInverter.cmv,
			})

			// Check battery
			if( primaryInverter.hasBatteryStorage() ) {
				this.homey.log("Inverter has battery storage");

				const batteryInfo = await this.api.getBatteryInfo();
				if( batteryInfo !== null ) {

					this.homey.log("Battery info fetched", batteryInfo );

					this.setSettings({
						solplanet_battery_model_label: batteryInfo.battery?.manufactoty ?? 'Unknown',
					})
				}
			} else {
				this.homey.log("Inverter does not have battery storage");
			}
		}
	}

	setDefaultInterval() {
		const settings = this.getSettings();

		this.interval = settings.interval ?? 60;
		this.resetInterval( this.interval );
	}

	async onSettings({ newSettings, changedKeys}) {
		// Init the API with new settings
		const solPlanetClient = new SolPlanetClient( newSettings.ip_address, newSettings.device_serial_number );
		const newApi = new SolPlanetApi( solPlanetClient );

		// Validate
		const inverterInfo = await newApi.getInverterInfo();
		if( inverterInfo === null ) {
			throw new Error(
				`Could not fetch the correct data. Check the settings.`
			);
		}

		// Overwrite
		this.api = newApi;

		// Force production check when API key is changed
		this.checkProduction();

		if (changedKeys.includes("interval") && newSettings.interval) {
			this.resetInterval( newSettings.interval );
			this.homey.log(`Changed interval to ${newSettings.interval}`);
		}
	}

	async checkProduction() {
		this.homey.log("Checking production");

		// Check if the device is available
		if( this.getAvailable() === false ) {
			this.homey.log("Device is not available. Stop the interval");
			this.stopInterval()
			return
		}

		if( this.api ) {
			try {

				const inverterInfo = await this.api.getInverterInfo();
				if( inverterInfo !== null ) {

					const primaryInverter = inverterInfo.getPrimaryInverter();
					const inverterData = await this.api.getInverterData();

					// Reset the checks failed
					if( this.checksFailed > 0 ) {
						this.checksFailed = 0;
						this.setDefaultInterval()
					}

					// FLG -> the current state of the device
					const deviceState = _.parseInt( inverterData.flg );
					this.homey.log( `Current device state is: ${ deviceState }` );

					if( deviceState !== 1 ) {
						if( deviceState === 0 ) {
							this.setValueWithCatch('measure_power.solar', 0 );
						}
						return;
					}

					// Temperature
					const currentTemperature = Number( _.parseInt( inverterData.tmp ) / 10 );
					this.homey.log( `Current inverter temperature is: ${ currentTemperature }` );

					if( currentTemperature !== undefined ) {
						this.setValueWithCatch("measure_temperature", currentTemperature);
					}

					// Inverter AC power (W) - can be negative for hybrid inverters
					// Positive = power output, Negative = power consumption (e.g., charging from grid)
					let inverterPower = Number( _.parseInt( primaryInverter.pac ) );
					this.homey.log( `Inverter AC power is: ${ inverterPower }W` );

					if( inverterPower !== undefined && Math.abs(inverterPower) <= 20000 ) {
						this.setValueWithCatch("measure_power.solar", inverterPower);
					}

					// Solar energy today (kWh) - etd field
					const solarEnergyToday = Math.abs( Number( _.parseInt( primaryInverter.etd ) / 10 ) );
					this.homey.log( `Solar energy today is: ${ solarEnergyToday }kWh` );

					if( solarEnergyToday !== undefined ) {
						this.setValueWithCatch("meter_power.solar_today", solarEnergyToday);
					}

					// Solar energy total (kWh) - eto field
					const solarEnergyTotal = Math.abs( Number( _.parseInt( primaryInverter.eto ) / 10 ) );
					this.homey.log( `Solar energy total is: ${ solarEnergyTotal }kWh` );

					if( solarEnergyTotal !== undefined ) {
						this.setValueWithCatch("meter_power.solar_total", solarEnergyTotal);
					}

					// Get meter data for grid power
					await this.updateMeterData();

					// Get battery data
					if( primaryInverter.hasBatteryStorage() ) {
						await this.updateBatteryData();
					}

					this.setAvailable().catch( this.onError.bind( this ) );
				}
			} catch (err) {
				this.onError( err );

				const now = new Date();
				const midnight = new Date();
				midnight.setHours(0,0,0,0);

				const threeAm = new Date();
				threeAm.setHours(3,0,0,0);

				if( now > midnight && now < threeAm ) {
					this.setCapabilityValue( "meter_power.solar_today", 0 ).catch( this.onError.bind( this ) );
					this.setCapabilityValue( "meter_power.grid_import_today", 0 ).catch( this.onError.bind( this ) );
					this.setCapabilityValue( "meter_power.grid_export_today", 0 ).catch( this.onError.bind( this ) );
				}

				if( this.checksFailed > 3 ) {
					this.resetInterval( 5 * 60 );
					this.setValueWithCatch('measure_power.solar', 0 );
					this.setValueWithCatch('measure_power.grid', 0 );
					this.setValueWithCatch('measure_power.battery', 0 );
				}
			}
		} else if ( !this.api ) {
			this.homey.log("SolPlanet could not be discovered on your network")

			await this.setUnavailable(
				"SolPlanet could not be discovered on your network"
			);
		}
	}

	async updateMeterData() {
		try {
			const meterData = await this.api.getMeterData();

			if( meterData !== null ) {
				// Grid power (W) - positive is import, negative is export
				const gridPower = Number( _.parseInt( meterData.pac ) );
				this.homey.log( `Grid power is: ${ gridPower }W` );

				if( gridPower !== undefined ) {
					this.setValueWithCatch("measure_power.grid", gridPower);
				}

				// Grid import today (kWh) - itd is in 0.01 kWh
				const gridImportToday = Math.abs( Number( _.parseInt( meterData.itd ) / 100 ) );
				this.homey.log( `Grid import today is: ${ gridImportToday }kWh` );

				if( gridImportToday !== undefined ) {
					this.setValueWithCatch("meter_power.grid_import_today", gridImportToday);
				}

				// Grid export today (kWh) - otd is in 0.01 kWh
				const gridExportToday = Math.abs( Number( _.parseInt( meterData.otd ) / 100 ) );
				this.homey.log( `Grid export today is: ${ gridExportToday }kWh` );

				if( gridExportToday !== undefined ) {
					this.setValueWithCatch("meter_power.grid_export_today", gridExportToday);
				}

				// Grid import total (kWh) - iet is in 0.1 kWh
				const gridImportTotal = Math.abs( Number( _.parseInt( meterData.iet ) / 10 ) );
				this.homey.log( `Grid import total is: ${ gridImportTotal }kWh` );

				if( gridImportTotal !== undefined ) {
					this.setValueWithCatch("meter_power.grid_import_total", gridImportTotal);
				}

				// Grid export total (kWh) - oet is in 0.1 kWh
				const gridExportTotal = Math.abs( Number( _.parseInt( meterData.oet ) / 10 ) );
				this.homey.log( `Grid export total is: ${ gridExportTotal }kWh` );

				if( gridExportTotal !== undefined ) {
					this.setValueWithCatch("meter_power.grid_export_total", gridExportTotal);
				}
			}
		} catch (err) {
			this.homey.log("Error fetching meter data:", err.message);
		}
	}

	async updateBatteryData() {
		try {
			const batteryData = await this.api.getBatteryData();

			if( batteryData !== null ) {
				// Battery SOC (%)
				const batterySoc = Number( _.parseInt( batteryData.soc ) );
				this.homey.log( `Battery SOC is: ${ batterySoc }%` );

				if( batterySoc !== undefined ) {
					this.setValueWithCatch("battery_soc", batterySoc);
				}

				// Battery power (W) - positive is charging, negative is discharging
				const batteryPower = Number( _.parseInt( batteryData.pb ) );
				this.homey.log( `Battery power is: ${ batteryPower }W` );

				if( batteryPower !== undefined ) {
					this.setValueWithCatch("measure_power.battery", batteryPower);
				}

				// Battery charge total (kWh) - ebi is in 0.1 kWh
				const batteryChargeTotal = Math.abs( Number( _.parseInt( batteryData.ebi ) / 10 ) );
				this.homey.log( `Battery charge total is: ${ batteryChargeTotal }kWh` );

				if( batteryChargeTotal !== undefined ) {
					this.setValueWithCatch("meter_power.battery_charge_total", batteryChargeTotal);
				}

				// Battery discharge total (kWh) - ebo is in 0.1 kWh
				const batteryDischargeTotal = Math.abs( Number( _.parseInt( batteryData.ebo ) / 10 ) );
				this.homey.log( `Battery discharge total is: ${ batteryDischargeTotal }kWh` );

				if( batteryDischargeTotal !== undefined ) {
					this.setValueWithCatch("meter_power.battery_discharge_total", batteryDischargeTotal);
				}
			}
		} catch (err) {
			this.homey.log("Error fetching battery data:", err.message);
		}
	}

	setValueWithCatch( capabilityId, value ) {
		this.setCapabilityValue( capabilityId, value ).catch( this.onError.bind( this ) );
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

module.exports = InverterWithBattery;
