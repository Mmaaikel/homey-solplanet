import Homey from 'homey';
import { randomUUID } from 'node:crypto'
import SolPlanetApi from '../../lib/SolPlanetApi.js';
import SolPlanetClient from "../../lib/SolPlanetClient.js";

class HybridSolarDriver extends Homey.Driver {

	ipAddress;
	deviceSerialNr;

	async onPair( session ) {

		session.setHandler("validate", async ({ ipAddress } = {}) => {
			this.homey.log("Pair data received" );
			this.homey.log("IP Address", ipAddress );

			this.ipAddress = ipAddress ?? '';
			this.deviceSerialNr = '';

			const solPlanetClient = new SolPlanetClient( this.ipAddress, this.deviceSerialNr );
			const solPlanetApi = new SolPlanetApi( solPlanetClient );

			const inverterInfo = await solPlanetApi.getInverterInfo();
			if( inverterInfo === null ) {
				return {
					error: "Could not fetch the correct data. Check the settings."
				}
			}

			// Verify this inverter has battery support (hybrid inverter)
			const primaryInverter = inverterInfo.getPrimaryInverter();
			const discoveredSerialNumber = String( primaryInverter?.isn ?? '' ).trim();
			if( !discoveredSerialNumber || discoveredSerialNumber === 'xxx' ) {
				return {
					error: "Could not discover the inverter serial number."
				}
			}

			if( !primaryInverter.hasBatteryStorage() ) {
				return {
					error: "This inverter does not have battery storage. Use the regular SolPlanet driver instead."
				}
			}

			this.deviceSerialNr = discoveredSerialNumber;
			this.homey.log("Discovered device serial number", this.deviceSerialNr );

			return primaryInverter.model;
		});

		session.setHandler("list_devices", async () => {
			this.homey.log("Listing devices: ");

			const devicesList = [];

			try {
				if( this.ipAddress && this.deviceSerialNr ) {

					const solPlanetClient = new SolPlanetClient( this.ipAddress, this.deviceSerialNr );
					const solPlanetApi = new SolPlanetApi( solPlanetClient );

					const inverterInfo = await solPlanetApi.getInverterInfo();
					if( inverterInfo !== null ) {

						const primaryInverter = inverterInfo.getPrimaryInverter();

						const isn = primaryInverter.isn || randomUUID();

						this.homey.log('System name: ', primaryInverter.model, isn );

						devicesList.push({
							name: `${primaryInverter.model} Solar`,
							data: {
								sid: `${isn}-solar`,
							},
							settings: {
								ip_address: this.ipAddress,
								device_serial_number: this.deviceSerialNr,
							},
						});
					}
				}
			} catch (err) {
				this.homey.log("Error listing devices: ", err );
			}

			return devicesList;
		});
	}
}

export default HybridSolarDriver;
