import { Inverter } from "../../lib/inverter.js";
import SolPlanetApi from "../../lib/SolPlanetApi.js";
import SolPlanetClient from "../../lib/SolPlanetClient.js";
import _ from 'lodash'

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

		// Set some info labels
		const inverterInfo = await this.api.getInverterInfo();
		if( inverterInfo !== null ) {

			const primaryInverter = inverterInfo.getPrimaryInverter();

			this.setSettings({
				solplanet_model_label: primaryInverter.model,
				solplanet_version_label: primaryInverter.cmv,
			})

			const list = this.getCapabilities()
			this.homey.log("Current capabilities: ", list );

			const createCapabilities = ['meter_power'];
			for( const capabilityId of createCapabilities ) {
				if( !this.hasCapability(capabilityId) ) {
					await this.addCapability(capabilityId);
					this.homey.log(`Added ${capabilityId} capability`);
				}
			}

			const removeCapabilities = ['meter_power.total'];
			for( const capabilityId of removeCapabilities ) {
				if( this.hasCapability(capabilityId) ) {
					await this.removeCapability(capabilityId);
					this.homey.log(`Removed ${capabilityId} capability`);
				}
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

		// Force production check when settings are changed
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

					// Reset the checks failed
					if( this.checksFailed > 0 ) {
						this.checksFailed = 0;
						this.setDefaultInterval()
					}

					// Get battery data for pure solar values
					if( primaryInverter.hasBatteryStorage() ) {
						await this.updateSolarData();
					}

					// Get meter data for grid power
					await this.updateMeterData();

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
					this.setValueWithCatch('measure_power', 0 );
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

	async updateSolarData() {
		try {
			const batteryData = await this.api.getBatteryData();

			if( batteryData !== null ) {
				// Temperature (C) - tb field in 0.1C
				const temperature = Number( _.parseInt( batteryData.tb ) / 10 );
				this.homey.log( `Temperature is: ${ temperature }C` );

				if( !isNaN(temperature) ) {
					this.setValueWithCatch("measure_temperature", temperature);
				}

				// Pure solar power (W) - ppv field from battery data
				const solarPower = Number( _.parseInt( batteryData.ppv ) );
				this.homey.log( `Solar PV power is: ${ solarPower }W` );

				if( !isNaN(solarPower) && solarPower <= 20000 ) {
					this.setValueWithCatch("measure_power", solarPower);
				}

				// Solar energy total (kWh) - etopv field in 0.1 kWh (cumulative, used by Homey Energy)
				const solarEnergyTotal = Math.abs( Number( _.parseInt( batteryData.etopv ) / 10 ) );
				this.homey.log( `Solar energy total is: ${ solarEnergyTotal }kWh` );

				if( !isNaN(solarEnergyTotal) ) {
					this.setValueWithCatch("meter_power", solarEnergyTotal);
				}

				// Solar energy today (kWh) - etdpv field in 0.1 kWh
				const solarEnergyToday = Math.abs( Number( _.parseInt( batteryData.etdpv ) / 10 ) );
				this.homey.log( `Solar energy today is: ${ solarEnergyToday }kWh` );

				if( !isNaN(solarEnergyToday) ) {
					this.setValueWithCatch("meter_power.solar_today", solarEnergyToday);
				}
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
				const gridPower = Number( _.parseInt( meterData.pac ) );
				this.homey.log( `Grid power is: ${ gridPower }W` );

				if( !isNaN(gridPower) ) {
					this.setValueWithCatch("measure_power.grid", gridPower);
				}

				// Grid import today (kWh) - itd is in 0.01 kWh
				const gridImportToday = Math.abs( Number( _.parseInt( meterData.itd ) / 100 ) );
				this.homey.log( `Grid import today is: ${ gridImportToday }kWh` );

				if( !isNaN(gridImportToday) ) {
					this.setValueWithCatch("meter_power.grid_import_today", gridImportToday);
				}

				// Grid export today (kWh) - otd is in 0.01 kWh
				const gridExportToday = Math.abs( Number( _.parseInt( meterData.otd ) / 100 ) );
				this.homey.log( `Grid export today is: ${ gridExportToday }kWh` );

				if( !isNaN(gridExportToday) ) {
					this.setValueWithCatch("meter_power.grid_export_today", gridExportToday);
				}

				// Grid import total (kWh) - iet is in 0.1 kWh
				const gridImportTotal = Math.abs( Number( _.parseInt( meterData.iet ) / 10 ) );
				this.homey.log( `Grid import total is: ${ gridImportTotal }kWh` );

				if( !isNaN(gridImportTotal) ) {
					this.setValueWithCatch("meter_power.grid_import_total", gridImportTotal);
				}

				// Grid export total (kWh) - oet is in 0.1 kWh
				const gridExportTotal = Math.abs( Number( _.parseInt( meterData.oet ) / 10 ) );
				this.homey.log( `Grid export total is: ${ gridExportTotal }kWh` );

				if( !isNaN(gridExportTotal) ) {
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
