import { fetch } from '../../helpers';

export default class SolPlanetApi {
	
	apiUrl;
	
	constructor( ip_address, device_nr, device_serial_number ) {
		
		// remove http and / from the ip address
		ip_address = this.cleanIpAddress( ip_address );
		
		// trim the device number
		device_nr = this.cleanValue( device_nr );
		
		// Trim the device serial number
		device_serial_number = this.cleanValue( device_serial_number );
		
		this.apiUrl = `http://${ ip_address }:8484/getdevdata.cgi?device=${ device_nr }&sn=${ device_serial_number }`
	}
	
	cleanIpAddress( ip_address ) {
		// remove http and / from the ip address
		ip_address = ip_address.replace(/(^\w+:|^)\/\//, '');
		
		// Remove the trailing slash
		ip_address = ip_address.replace(/\/$/, '');
		
		// Trim the ip address
		ip_address = ip_address.replace(/\s/g, '').trim();
		
		return ip_address;
	}
	
	cleanValue( value ) {
		return value.replace(/\s/g, '').trim();
	}
	
	async getData() {
		const response = await fetch( this.apiUrl, {
			method: 'GET',
			cache: 'no-cache',
			redirect: 'follow',
			headers: {
				'Content-Type': 'application/json'
			},
		})
		
		// Hard error. Throw directly
		if( !response.ok ) {
			return null;
		}
		
		try {
			return await response.json();
		} catch ( err ) {}
		
		return null;
	}
	
	isValid( responseJson ) {
		if( responseJson === null ) {
			return false;
		}
		
		// Tim is the time of the inverter, when not set or empty the returned data is not correct
		if( !responseJson?.tim || responseJson.tim === '' || responseJson.tim === '19700101000011' ) {
			return false;
		}
		
		if( !responseJson?.pac || responseJson.pac === 0 ) {
			return false;
		}
		
		return true;
	}
	
	async validate() {
		// Get data and check if we error?
		try {
			const data = await this.getData();
			
			return this.isValid( data );
		} catch ( err ) {
			return false;
		}
	}
	
	async getSystemName() {
		// Get data and check if we error?
		let data = null;
		
		try {
			data = await this.getData();
		} catch ( e ) {
			return null;
		}
		
		// Check if the data is valid
		if( this.isValid( data ) === false ) {
			return null;
		}
		
		return 'Solplanet Inverter'
	}
}
