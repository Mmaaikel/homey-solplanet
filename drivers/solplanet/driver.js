import { Driver } from "homey";
import SolPlanetApi from './api'

class SolPlanetDriver extends Driver {
	
	ipAddress;
	deviceNr;
	deviceSerialNr;
	
	async onPair( session ) {
		session.setHandler("validate", async (data) => {
			this.homey.log("Pair data received", data );
			
			const { ipAddress, deviceNr, deviceSerialNr } = data;
			
			this.ipAddress = ipAddress;
			this.deviceNr = deviceNr;
			this.deviceSerialNr = deviceSerialNr;
			
			return new SolPlanetApi( this.ipAddress, this.deviceNr, this.deviceSerialNr ).getSystemName();
		});
		
		session.setHandler("list_devices", async () => {
			this.homey.log("Listing devices: ");
			
			const devicesList = [];
			
			try {
				if( this.ipAddress && this.deviceNr && this.deviceSerialNr ) {
					const api = await new SolPlanetApi( this.ipAddress, this.deviceNr, this.deviceSerialNr );
					
					// Get the system name
					const systemName = await api.getSystemName();
					
					devicesList.push({
						name: systemName,
						data: {
							sid: this.systemId,
						},
						settings: {
							ip_address: this.ipAddress,
							device_nr: this.deviceNr,
							device_serial_number: this.deviceSerialNr,
						},
					});
				}
			} catch (err) {
				this.homey.log("Error listing devices: ", err );
			}
			
			return devicesList;
		});
	}
}

module.exports = SolPlanetDriver;
