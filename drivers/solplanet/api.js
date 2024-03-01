import { fetch } from '../../helpers';

export default class SolPlanetApi {
	
	apiUrl;
	
	constructor( ip_address, device_nr, device_serial_number ) {
		this.apiUrl = `http://${ ip_address }:8484/getdevdata.cgi?device=${ device_nr }&sn=${ device_serial_number }`
	}
	
	async getData() {
		const response = await fetch( this.apiUrl, {
			method: 'GET',
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json'
			},
			redirect: 'follow',
			referrerPolicy: 'no-referrer'
		})
		
		if( !response.ok ) {
			throw new Error(
				"An unknown error occurred while fetching inverter data."
			);
		}
		
		return response.json();
	}
	
	async getSystemName() {
		// Get data and check if we error?
		const data = await this.getData();
		
		return 'Solplanet Inverter'
	}
}
