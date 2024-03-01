import { Inverter } from "../../inverter";

import SolPlanetApi from "./api";

class SolPlanet extends Inverter {
	
	interval = 60;
	api;
	
	async onInit() {
		const data = this.getData();
		const settings = this.getSettings();
		
		this.homey.log("SolPlanet driver initialized");
		this.homey.log( data );
		this.homey.log( settings );
		
		// Init the API
		this.api = new SolPlanetApi( settings.ip_address, settings.device_nr, settings.device_serial_number );
		this.interval = settings.interval ?? 60;
		
		// Init settings
		await this.setIncludeInTotals( settings );
		
		super.onInit();
	}
	
	async setIncludeInTotals( settings ) {
		const includeInTotals = settings.include_in_totals ?? false``
		
		// DOT USE THE ENERGY SETTINGS
	}
	
	async onSettings({ newSettings, changedKeys}) {
		// Init the API with new settings
		const newApi = new SolPlanetApi( newSettings.ip_address, newSettings.device_nr, newSettings.device_serial_number );
		
		// Validate
		await newApi.getSystemName();
		
		// Overwrite
		this.api = newApi;
		
		// Update settings
		await this.setIncludeInTotals( newSettings );
		
		// Force production check when API key is changed
		this.checkProduction();
		
		if (changedKeys.includes("interval") && newSettings.interval) {
			this.resetInterval( newSettings.interval );
			this.homey.log(`Changed interval to ${newSettings.interval}`);
		}
	}
	
	async checkProduction() {
		this.homey.log("Checking production");
		
		if (this.api ) {
			try {
				const productionData = await this.api.getData();
				
				// Temperature
				const currentTemperature = productionData.tmp / 10;
				await this.setCapabilityValue( "measure_temperature", currentTemperature );
				this.homey.log(
					`Current inverter temperature is ${currentTemperature}`
				);
				
				// Current (w)
				const currentProductionPower = productionData.pac;
				await this.setCapabilityValue( "measure_power", currentProductionPower );
				this.homey.log(
					`Current production power is ${currentProductionPower}W`
				);
				
				// Daily (kWh)
				const dailyProductionEnergy = productionData.etd / 10;
				await this.setCapabilityValue("meter_power", dailyProductionEnergy );
				this.homey.log(
					`Daily production energy is ${dailyProductionEnergy}kWh`
				);
				
				// Total (kWh)
				const totalProductionEnergy = productionData.eto / 10;
				await this.setCapabilityValue("meter_power.total", totalProductionEnergy );
				this.homey.log(
					`Total production energy is ${totalProductionEnergy}kWh`
				);
				
				await this.setAvailable();
			} catch (err) {
				const errorMessage = err.message;
				
				await this.setCapabilityValue( "measure_power", 0 );
				
				this.homey.log(`Unavailable: ${errorMessage}`);
				//await this.setUnavailable(errorMessage);
			}
		} else if ( !this.api ) {
			//await this.setUnavailable(
			//	"SolPlanet could not be discovered on your network"
			//);
		}
	}
}

module.exports = SolPlanet;
