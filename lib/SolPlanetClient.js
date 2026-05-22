

class SolPlanetClient {

    ipAddress;
    deviceSerialNumber;

    constructor( ipAddress, deviceSerialNumber ) {
        this.ipAddress = this.cleanIpAddress( ipAddress );
        this.deviceSerialNumber = this.cleanValue( deviceSerialNumber );
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

    createUrl( deviceNr, action ) {

        const endpoints = {
            info: 'getdev.cgi',
            data: 'getdevdata.cgi'
        };

        return `http://${ this.ipAddress }:8484/${ endpoints[ action ] }?device=${ deviceNr }&sn=${ this.deviceSerialNumber }`;
    }

    fetch = async ( url ) => {
        try {
            const response = await fetch( url, {
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
            
            return await response.json();
        } catch ( err ) {}
        
        return null;
    }
}

export default SolPlanetClient