
import https from 'node:https';
import fetch from 'node-fetch';

class SolPlanetClient {

    ipAddress;
    baseUrl;
    baseUrls;
    baseUrlResolved;
    deviceSerialNumber;
    requestTimeoutMs = 10000;
    insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

    constructor( ipAddress, deviceSerialNumber ) {
        this.ipAddress = this.cleanIpAddress( ipAddress );
        this.baseUrls = this.createBaseUrls( this.ipAddress );
        this.baseUrl = this.baseUrls[ 0 ];
        this.baseUrlResolved = this.baseUrls.length === 1;
        this.deviceSerialNumber = this.cleanValue( deviceSerialNumber );
    }
	
	cleanIpAddress( ip_address ) {
		return String( ip_address ?? '' ).replace(/\s/g, '').replace(/\/+$/, '');
	}

	createBaseUrls( ipAddress ) {
		if( !ipAddress ) {
			throw new Error('Enter the inverter IP address.');
		}

		if( /^https?:\/\//i.test( ipAddress ) ) {
			return [ ipAddress ];
		}

		let parsedAddress;
		try {
			parsedAddress = new URL(`http://${ ipAddress }`);
		} catch ( err ) {
			throw new Error('Enter a valid inverter IP address or URL.', { cause: err });
		}

		if( parsedAddress.pathname !== '/' || parsedAddress.search || parsedAddress.hash ) {
			throw new Error('Enter a valid inverter IP address or URL.');
		}

		const httpHost = parsedAddress.port ? parsedAddress.host : `${ parsedAddress.hostname }:8484`;
		const httpsHost = parsedAddress.port ? parsedAddress.host : parsedAddress.hostname;

		return [
			`http://${ httpHost }`,
			`https://${ httpsHost }`,
		];
	}

	getBaseUrl() {
		return this.baseUrl;
	}
	
	cleanValue( value ) {
		return String( value ?? '' ).replace(/\s/g, '').trim();
	}

    createUrl( deviceNr, action ) {

        const endpoints = {
            info: 'getdev.cgi',
            data: 'getdevdata.cgi'
        };

        const serialNumberParameter = this.deviceSerialNumber ? `&sn=${ this.deviceSerialNumber }` : '';

        return `${ this.baseUrl }/${ endpoints[ action ] }?device=${ deviceNr }${ serialNumberParameter }`;
    }

    fetch = async ( url ) => {
        const relativeUrl = url.startsWith( this.baseUrl ) ? url.slice( this.baseUrl.length ) : url;
        const candidateBaseUrls = this.baseUrlResolved ? [ this.baseUrl ] : this.baseUrls;
        
        let lastError;
        for( const candidateBaseUrl of candidateBaseUrls ) {
            const candidateUrl = url.startsWith( this.baseUrl ) ? `${ candidateBaseUrl }${ relativeUrl }` : url;

            try {
                const data = await this.fetchUrl( candidateUrl );
                this.baseUrl = candidateBaseUrl;
                this.baseUrlResolved = true;

                return data;
            } catch ( err ) {
                lastError = err;
            }
        }

        if( candidateBaseUrls.length > 1 ) {
            throw new Error(
                'Could not connect using HTTP on port 8484 or HTTPS. Check the inverter IP address and network connection.',
                { cause: lastError }
            );
        }

        throw lastError;
    }

    fetchUrl = async ( url ) => {
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
