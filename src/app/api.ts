import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Api {
    lakefinder_api = "https://maps.dnr.state.mn.us/cgi-bin/lakefinder/search.cgi?";
    lake_survey_api = "https://maps.dnr.state.mn.us/cgi-bin/lakefinder/detail.cgi?";
    office_api = "https://maps.dnr.state.mn.us/cgi-bin/offices.cgi";

    constructor(private httpClient: HttpClient) { }

    public GetLakesByCounty(id: number): Promise<any> {
        return firstValueFrom(
            this.httpClient.get<any>(this.lakefinder_api, {
                params: new HttpParams().append("county", id)
            })
        );
    }

    public GetLakeData(id: number): Promise<any> {
        return firstValueFrom(
            this.httpClient.get<any>(this.lake_survey_api, {
                params: new HttpParams().append("type", "lake_survey").append("id", id)
            })
        );
    }

    public GetLakeByName(name: string,county: number): Promise<any> {
        return firstValueFrom(
            this.httpClient.get<any>(this.lakefinder_api, {
                params: new HttpParams().append("name", name).append("county", county)
            })
        );
    }
  
}