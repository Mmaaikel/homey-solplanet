

class SolPlanetClient {

    ipAddress;
    baseUrl;
    deviceSerialNumber;

    constructor( ipAddress, deviceSerialNumber ) {
        this.ipAddress = this.cleanIpAddress( ipAddress );
        this.baseUrl = this.createBaseUrl( this.ipAddress );
        this.deviceSerialNumber = this.cleanValue( deviceSerialNumber );
    }
	
	cleanIpAddress( ip_address ) {
		return ip_address.replace(/\s/g, '').replace(/\/+$/, '');
	}

	createBaseUrl( ipAddress ) {
		if( /^https?:\/\//i.test( ipAddress ) ) {
			return ipAddress;
		}

		return `http://${ ipAddress }:8484`;
	}
	
	cleanValue( value ) {
		return value.replace(/\s/g, '').trim();
	}

    createUrl( deviceNr, action ) {

        const endpoints = {
            info: 'getdev.cgi',
            data: 'getdevdata.cgi'
        };

        const serialNumberParameter = this.deviceSerialNumber
            ? `&sn=${ this.deviceSerialNumber }`
            : '';

        return `${ this.baseUrl }/${ endpoints[ action ] }?device=${ deviceNr }${ serialNumberParameter }`;
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
