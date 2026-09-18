
import https from 'node:https';
import fetch from 'node-fetch';

class SolPlanetClient {

    ipAddress;
    baseUrl;
    deviceSerialNumber;
    requestTimeoutMs = 10000;
    insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

        try {
            const response = await fetch( url, {
                method: 'GET',
                cache: 'no-cache',
                redirect: 'follow',
                agent: /^https:/i.test( url ) ? this.insecureHttpsAgent : undefined,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json'
                },
            })
            
            if( !response.ok ) {
                throw new Error(
                    `SolPlanet request failed with HTTP ${ response.status } ${ response.statusText }`
                );
            }
            
            return await response.json();
        } catch ( err ) {
            if( err.name === 'AbortError' ) {
                throw new Error(
                    `SolPlanet request timed out after ${ this.requestTimeoutMs }ms`,
                    { cause: err }
                );
            }

            if( err.message?.startsWith('SolPlanet request failed') ) {
                throw err;
            }

            throw new Error(
                `SolPlanet request failed: ${ err.message ?? String( err ) }`,
                { cause: err }
            );
        } finally {
            clearTimeout( timeout );
        }
    }
}

export default SolPlanetClient
