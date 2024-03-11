import { Inverter } from "../../inverter";

import SolPlanetApi from "./api";

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
		
		this.interval = settings.interval ?? 60;
		
		super.onInit();
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
		
		if( this.api ) {
			try {
				const productionData = await this.api.getData();
				
				// Check the data
				if( this.api.isValid( productionData ) ) {
					// Reset the checks failed
					this.checksFailed = 0;
					
					// Temperature
					const currentTemperature = productionData.tmp / 10;
					await this.setCapabilityValue( "measure_temperature", currentTemperature );
					this.homey.log( `Current inverter temperature is ${ currentTemperature }` );
					
					// Current (w)
					const currentProductionPower = productionData.pac;
					await this.setCapabilityValue( "measure_power", currentProductionPower );
					this.homey.log( `Current production power is ${ currentProductionPower }W` );
					
					// Daily (kWh)
					const dailyProductionEnergy = productionData.etd / 10;
					await this.setCapabilityValue( "meter_power", dailyProductionEnergy );
					this.homey.log( `Daily production energy is ${ dailyProductionEnergy }kWh` );
					
					// Total (kWh)
					const totalProductionEnergy = productionData.eto / 10;
					await this.setCapabilityValue( "meter_power.total", totalProductionEnergy );
					this.homey.log( `Total production energy is ${ totalProductionEnergy }kWh` );
					
					await this.setAvailable();
				}
			} catch (err) {
				const errorMessage = err.message;
				
				await this.setCapabilityValue( "measure_power", 0 );
				
				// Update the fail checks
				this.checksFailed++;
				this.homey.log(`Unavailable (${this.checksFailed}): ${errorMessage}`);
				
				// Check if it is later than midnight
				const now = new Date();
				const midnight = new Date();
				midnight.setHours(0,0,0,0);
				
				// And before 3 AM
				const threeAm = new Date();
				threeAm.setHours(3,0,0,0);
				
				if( now > midnight && now < threeAm ) {
					// Update the daily production
					await this.setCapabilityValue( "meter_power", 0 );
				}
				
				if( this.checksFailed > 3 ) {
					// Change the interval to 5 minutes
					this.resetInterval( 5 * 60 );
				}
			}
		} else if ( !this.api ) {
			await this.setUnavailable(
				"SolPlanet could not be discovered on your network"
			);
		}
	}
}

module.exports = SolPlanet;
