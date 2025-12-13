import { Driver } from "homey";
import { randomUUID } from 'node:crypto'
import SolPlanetApi from '../solplanet/library/SolPlanetApi';
import SolPlanetClient from "../solplanet/library/SolPlanetClient";

class InverterWithBatteryDriver extends Driver {

	ipAddress;
	deviceNr;
	deviceSerialNr;

	async onPair( session ) {

		session.setHandler("validate", async ({ ipAddress, deviceSerialNr } = {}) => {
			this.homey.log("Pair data received" );
			this.homey.log("IP Address", ipAddress );
			this.homey.log("Device Serial Nr", deviceSerialNr );

			this.ipAddress = ipAddress ?? '';
			this.deviceSerialNr = deviceSerialNr ?? '';

			const solPlanetClient = new SolPlanetClient( this.ipAddress, this.deviceSerialNr );
			const solPlanetApi = new SolPlanetApi( solPlanetClient );

			const inverterInfo = await solPlanetApi.getInverterInfo();
			if( inverterInfo === null ) {
				return {
					error: "Could not fetch the correct data. Check the settings."
				}
			}

			// Verify this inverter has battery support
			const primaryInverter = inverterInfo.getPrimaryInverter();
			if( !primaryInverter.hasBatteryStorage() ) {
				return {
					error: "This inverter does not have battery storage. Use the regular SolPlanet driver instead."
				}
			}

			return inverterInfo.model;
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

						// Get the system name
						const sid = primaryInverter.isn || randomUUID();

						this.homey.log('System name: ', primaryInverter.model, sid );

						devicesList.push({
							name: `Solplanet (with Battery)`,
							data: {
								sid: sid,
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

module.exports = InverterWithBatteryDriver;
