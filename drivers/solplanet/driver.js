import { Driver } from "homey";
import SolPlanetApi from './api'
import { randomUUID } from 'node:crypto'

class SolPlanetDriver extends Driver {
	
	ipAddress;
	deviceNr;
	deviceSerialNr;
	
	async onPair( session ) {
		session.setHandler("validate", async ({ ipAddress, deviceNr, deviceSerialNr } = {}) => {
			this.homey.log("Pair data received" );
			this.homey.log("IP Address", ipAddress );
			this.homey.log("Device Nr", deviceNr );
			this.homey.log("Device Serial Nr", deviceSerialNr );
			
			this.ipAddress = ipAddress ?? '';
			this.deviceNr = deviceNr ?? '';
			this.deviceSerialNr = deviceSerialNr ?? '';
			
			return new SolPlanetApi( this.ipAddress, this.deviceNr, this.deviceSerialNr ).getSystemName();
		});
		
		session.setHandler("list_devices", async () => {
			this.homey.log("Listing devices: ");
			
			const devicesList = [];
			
			try {
				if( this.ipAddress && this.deviceNr && this.deviceSerialNr ) {
					const api = new SolPlanetApi( this.ipAddress, this.deviceNr, this.deviceSerialNr );
					
					// Get the system name
					const sid = randomUUID();
					const systemName = await api.getSystemName();
					
					this.homey.log('System name:', systemName );
					
					devicesList.push({
						name: systemName,
						data: {
							sid: sid,
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
