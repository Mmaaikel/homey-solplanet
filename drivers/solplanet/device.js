import { Inverter } from "../../inverter";
import SolPlanetApi from "./library/SolPlanetApi.js";
import SolPlanetClient from "./library/SolPlanetClient.js";
import _ from 'lodash'

class SolPlanet extends Inverter {
	
	checksFailed = 0;
	interval = 60;
	api;
	
	async onInit() {
		this.homey.log('SolPlanet has been initialized')
		
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

				// Add battery_soc capability if not present
				if( !this.hasCapability('battery_soc') ) {
					await this.addCapability('battery_soc');
					this.homey.log("Added battery_soc capability");
				}

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
		const inverterInfo = await solPlanetApi.getInverterInfo();
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

					// Setting?
					const primaryInverter = inverterInfo.getPrimaryInverter();

					// Also get the data now
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
							this.setValueWithCatch('measure_power', 0 );
						}

						return;
					}
					
					// Temperature
					const currentTemperature = Number( _.parseInt( inverterData.tmp ) / 10 );
					this.homey.log( `Current inverter temperature is: ${ currentTemperature }` );
					
					if( currentTemperature !== undefined ) {
						this.setValueWithCatch("measure_temperature", currentTemperature);
					}
					
					// Current (w)
					let currentProductionPower = Number( _.parseInt( primaryInverter.pac ) );
					this.homey.log( `Current production power is: ${ currentProductionPower }W` );
					
					// Ignore when the current production power is more than 20k?
					if( currentProductionPower !== undefined && currentProductionPower <= 20000 ) {
						this.setValueWithCatch("measure_power", currentProductionPower);
					}
					
					// Daily (kWh)
					const dailyProductionEnergy = Math.abs( Number( _.parseInt( primaryInverter.etd ) / 10 ) );
					this.homey.log( `Daily production energy is: ${ dailyProductionEnergy }kWh` );
					
					if( dailyProductionEnergy !== undefined ) {
						this.setValueWithCatch("meter_power", dailyProductionEnergy);
					}
					
					// Total (kWh)
					const totalProductionEnergy = Number( _.parseInt( primaryInverter.eto ) / 10 );
					this.homey.log( `Total production energy is: ${ totalProductionEnergy }kWh` );
					
					if( totalProductionEnergy !== undefined ) {
						this.setValueWithCatch("meter_power.total", totalProductionEnergy);
					}

					// Check if there is a battery
					if( primaryInverter.hasBatteryStorage() ) {

						// Get the battery info
						const batteryData = await this.api.getBatteryData();

						if( batteryData !== null ) {

							// Battery %
							const batteryPower = Number( _.parseInt( batteryData.soc ) );
							this.homey.log( `Battery percentage is: ${ batteryPower }%` );
							
							if( batteryPower !== undefined ) {
								this.setValueWithCatch("battery_soc", batteryPower);
							}
						}
					}
					
					this.setAvailable().catch( this.onError.bind( this ) );
				}
			} catch (err) {
				// Log the error
				this.onError( err );
				
				// Check if it is later than midnight
				const now = new Date();
				const midnight = new Date();
				midnight.setHours(0,0,0,0);
				
				// And before 3 AM
				const threeAm = new Date();
				threeAm.setHours(3,0,0,0);
				
				if( now > midnight && now < threeAm ) {
					// Update the daily production
					this.setCapabilityValue( "meter_power", 0 ).catch( this.onError.bind( this ) );
				}

				if( this.checksFailed > 3 ) {
					// Change the interval to 5 minutes
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

	setValueWithCatch( capabilityId, value ) {
		this.setCapabilityValue( capabilityId, value ).catch( this.onError.bind( this ) );
	}
	
	onError (error) {
		const errorMessage = error.message;
		
		// If the error message contains the words 'not found' we have to stop the interval
		// This means the device is not there anymore and we should not do anything...
		if( errorMessage.toLowerCase().includes('not found') ) {
			this.homey.log('Device could not be found. Stop the interval');
			this.stopInterval()
			return
		}
		
		// Update the fail checks
		this.checksFailed++;
		this.homey.log(`Unavailable (${this.checksFailed}): ${errorMessage}`);
	}
}

module.exports = SolPlanet;
