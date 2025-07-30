import { Inverter } from "../../inverter";

import SolPlanetApi from "./api";
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
		this.api = new SolPlanetApi( settings.ip_address, settings.device_nr, settings.device_serial_number );
		this.homey.log('Api created', this.api.apiUrl )
		
		this.setDefaultInterval()
		
		super.onInit();
	}
	
	setDefaultInterval() {
		const settings = this.getSettings();
		
		this.interval = settings.interval ?? 60;
		this.resetInterval( this.interval );
	}
	
	async onSettings({ newSettings, changedKeys}) {
		// Init the API with new settings
		const newApi = new SolPlanetApi( newSettings.ip_address, newSettings.device_nr, newSettings.device_serial_number );
		
		// Validate
		if( await newApi.validate() === false ) {
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
				const productionData = await this.api.getData();
				
				// Check the data
				if( this.api.isValid( productionData ) ) {
					
					// Reset the checks failed
					if( this.checksFailed > 0 ) {
						this.checksFailed = 0;
						this.setDefaultInterval()
					}
					
					// Temperature
					const currentTemperature = Number( _.parseInt( productionData.tmp ) / 10 );
					this.homey.log( `Current inverter temperature is ${ currentTemperature }` );
					
					if( currentTemperature !== undefined ) {
						this.setCapabilityValue( "measure_temperature", currentTemperature ).catch( this.onError.bind( this ) );
					}
					
					// Current (w)
					const currentProductionPower = Number( _.parseInt( productionData.pac ) );
					this.homey.log( `Current production power is ${ currentProductionPower }W` );
					
					// Ignore when the current production power is more than 20k?
					if( currentProductionPower !== undefined && currentProductionPower <= 20000 ) {
						this.setCapabilityValue( "measure_power", currentProductionPower ).catch( this.onError.bind( this ) );
					}
					
					// Daily (kWh)
					const dailyProductionEnergy = Number( _.parseInt( productionData.etd ) / 10 );
					this.homey.log( `Daily production energy is ${ dailyProductionEnergy }kWh` );
					
					if( dailyProductionEnergy !== undefined ) {
						this.setCapabilityValue( "meter_power", dailyProductionEnergy ).catch( this.onError.bind( this ) );
					}
					
					// Total (kWh)
					const totalProductionEnergy = Number( _.parseInt( productionData.eto ) / 10 );
					this.homey.log( `Total production energy is ${ totalProductionEnergy }kWh` );
					
					if( totalProductionEnergy !== undefined ) {
						this.setCapabilityValue( "meter_power.total", totalProductionEnergy ).catch( this.onError.bind( this ) );
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
