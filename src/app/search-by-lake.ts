import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { staticcontent } from './global/globals';
import { Api } from './api';

interface Filters {
  averageWeightMin?: string;
  averageWeightMax?: string;
  distanceMin?: string;
  distanceMax?: string;
  surveyYearFrom?: string;
  surveyYearTo?: string;
  totalMin?: string;
  totalMax?: string;
  lakeSizeMin?: string;
  lakeSizeMax?: string;
  [key: string]: any;
}

@Component({
  selector: 'search-by-lake',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-by-lake.html',
  styleUrls: ['./search-by-lake.css']
})
export class SearchByLake implements OnInit {
  lakeName = '';
  countyInput = 0;
  speciesInput = '';
  counties: { County: string; Id: number }[] = staticcontent.counties;
  species: { Species: string; Id: string }[] = staticcontent.Species;
  searchstatus = '';
  searchResult: any = null;
  hasSearched = false;
  isSearching = false;
  lakeTableData: any[] = [];
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  dialogVisible = false;
  dialogContent = '';
  safeDialogContent: SafeHtml = '';
  currentLocation: { latitude: number; longitude: number } | null = null;
  locationStatus = '';
  filters: Filters = {};
  private locationRequested = false;

  constructor(private apiService: Api, private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.requestCurrentLocation();
  }

  private setStatus(message: string) {
    this.searchstatus = message;
    this.cdr.detectChanges();
  }

  private requestCurrentLocation(): void {
    if (this.locationRequested || typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    this.locationRequested = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        this.locationStatus = 'Using your current location for distance.';
        this.updateLakeDistances();
        this.cdr.detectChanges();
      },
      () => {
        this.locationStatus = 'Location unavailable; distance will show as N/A.';
        this.cdr.detectChanges();
      }
    );
  }

  public getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const earthRadiusMiles = 3958.8;
    const toRadians = (value: number) => (value * Math.PI) / 180;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMiles * c;
  }

  private updateLakeDistances(): void {
    if (!this.currentLocation) {
      return;
    }

    this.lakeTableData = this.lakeTableData.map((lake: any) => ({
      ...lake,
      distanceMiles: this.getDistanceMilesForLake(lake)
    }));
    this.cdr.detectChanges();
  }

  private getDistanceMilesForLake(lake: any): number | null {
    if (!this.currentLocation || !Array.isArray(lake.waterAccess) || lake.waterAccess.length < 2) {
      return null;
    }

    const [longitude, latitude] = lake.waterAccess as [number, number];
    return this.getDistanceMiles(this.currentLocation.latitude, this.currentLocation.longitude, latitude, longitude);
  }

    private GetLengthCount(survey: any, species: string, min: number, max: number) {
    let count = 0;
    if (survey.lengths[species] != undefined) {
      for (let i = 0; i < survey.lengths[species].fishCount.length; i++) {
        if (survey.lengths[species].fishCount[i][0] >= min && survey.lengths[species].fishCount[i][0] <= max) {
          count += survey.lengths[species].fishCount[i][1];
        }
      }
    }
    return count;
  }


  

    private revealfishlengthstats(survey: any, species: string) {
    const fishlen: any[] = [];
    const speciesKey = species || survey.species;
    fishlen.push(this.GetLengthCount(survey, speciesKey, 0, 5));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 6, 7));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 8, 9));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 10, 11));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 12, 14));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 15, 19));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 20, 24));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 25, 29));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 30, 34));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 35, 39));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 40, 44));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 45, 49));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 50, 100));
    fishlen.push(this.GetLengthCount(survey, speciesKey, 0, 100));
    return fishlen;
  }

  public async getLakeByName(name: string, county: number) {
    this.hasSearched = true;
    this.isSearching = true;
    this.searchResult = null;
    this.lakeTableData = [];

    const query = name?.trim();
    if (!query) {
      this.setStatus('Please enter a lake name.');
      return;
    }

    if (!this.speciesInput) {
      this.setStatus('Please select a species.');
      return;
    }

    this.setStatus(`Searching for lake named "${query}"...`);
    try {
      const result = await this.apiService.GetLakeByName(query, county);
      if (!result?.results?.length) {
        this.setStatus(`No lake found with the name "${query}".`);
        return;
      }

      this.setStatus(`Found ${result.results.length} matching lake(s). Retrieving survey data...`);

      // Process all matching lakes
      for (let lakeIndex = 0; lakeIndex < result.results.length; lakeIndex++) {
        const lake = result.results[lakeIndex];
        try {
          const survey = await this.apiService.GetLakeData(lake.id);

          if (!survey || survey.status !== 'SUCCESS' || survey.message !== 'Normal execution.') {
            continue;
          }

          const surveyData = Array.isArray(survey.result?.surveys) ? survey.result.surveys : [];
          if (!surveyData.length) {
            continue;
          }

          const normalizedSurveyData = surveyData.map((data: any) => ({ ...data, surveyDate: new Date(data.surveyDate) }));
          normalizedSurveyData.sort((a: any, b: any) => a.surveyDate - b.surveyDate);
          const standardSurveys = normalizedSurveyData.filter((x: any) => x.surveyType == 'Standard Survey');

          const latestSurvey = standardSurveys[standardSurveys.length - 1];
          if (!latestSurvey) {
            continue;
          }

          const speciesToAnalyze = this.speciesInput;
          const fishlenarray = this.revealfishlengthstats(latestSurvey, speciesToAnalyze);
          const speciesdata = (latestSurvey.fishCatchSummaries ?? []).filter((fish: any) => fish.species == speciesToAnalyze);

          if (fishlenarray[13] > 0) {
            this.lakeTableData.push({
              name: lake.name,
              county: lake.county,
              lakeSize: survey.result?.areaAcres ?? lake.area ?? 'N/A',
              speciesdata: speciesdata[speciesdata.length - 1] ?? null,
              fishlengths: {
                zero: fishlenarray[0],
                one: fishlenarray[1],
                two: fishlenarray[2],
                three: fishlenarray[3],
                four: fishlenarray[4],
                five: fishlenarray[5],
                six: fishlenarray[6],
                seven: fishlenarray[7],
                eight: fishlenarray[8],
                nine: fishlenarray[9],
                ten: fishlenarray[10],
                eleven: fishlenarray[11],
                twelve: fishlenarray[12],
                total: fishlenarray[13]
              },
              surveyDate: latestSurvey.surveyDate,
              lakeid: lake.id,
              narrative: latestSurvey.narrative,
              waterAccess: lake.point?.['epsg:4326'],
              distanceMiles: this.getDistanceMilesForLake({ waterAccess: lake.point?.['epsg:4326'] })
            });
          }
        } catch (innerErr) {
          console.error(`Error processing lake ${lake.name}:`, innerErr);
          continue;
        }
      }

      this.cdr.detectChanges();

      if (this.lakeTableData.length === 0) {
        this.setStatus(`No lakes found with sampled fish for species ${this.speciesInput ? this.species.find((s: any) => s.Id === this.speciesInput)?.Species : 'any'}.`);
      } else {
        this.setStatus(`Found ${this.lakeTableData.length} lake(s) with survey data.`);
      }
      this.isSearching = false;

    } catch (err) {
      console.error(err);
      this.setStatus('Error searching for lakes by name.');
      this.isSearching = false;
    }
  }

  public GoToLake(lakeid: number) {
    window.open('https://www.dnr.state.mn.us/lakefind/lake.html?id=' + lakeid, '_blank');
  }

  public GoToWaterAccess(x: number, y: number) {
    window.open('http://maps.google.com/?saddr=current+location&daddr=' + x + ',' + y, '_blank');
  }

  public openTopo(x: number, y: number) {
    window.open('https://fishing-app.gpsnauticalcharts.com/i-boating-fishing-web-app/fishing-marine-charts-navigation.html#14.7/' + x + '/' + y, '_blank');
  }

  public openDialog(content: string) {
    this.dialogContent = content || 'No summary available.';
    const highlightedContent = this.highlightSpecies(this.dialogContent);
    this.safeDialogContent = this.sanitizer.bypassSecurityTrustHtml(highlightedContent);
    this.dialogVisible = true;
    this.cdr.detectChanges();
  }

  public closeDialog() {
    this.dialogVisible = false;
  }

  get filteredLakeTableData() {
    const hasAny = Object.keys(this.filters).some((k) => {
      const v = (this.filters as any)[k];
      return v !== undefined && v !== null && v !== '';
    });

    if (!hasAny) {
      return this.lakeTableData;
    }

    return this.lakeTableData.filter((lake: any) => {
      const minAW = this.filters.averageWeightMin ? parseFloat(this.filters.averageWeightMin) : NaN;
      const maxAW = this.filters.averageWeightMax ? parseFloat(this.filters.averageWeightMax) : NaN;
      if (!isNaN(minAW) || !isNaN(maxAW)) {
        const val = Number(lake.speciesdata?.averageWeight) || 0;
        if (!isNaN(minAW) && val < minAW) return false;
        if (!isNaN(maxAW) && val > maxAW) return false;
      }

      const minDistance = this.filters.distanceMin ? parseFloat(this.filters.distanceMin) : NaN;
      const maxDistance = this.filters.distanceMax ? parseFloat(this.filters.distanceMax) : NaN;
      if (!isNaN(minDistance) || !isNaN(maxDistance)) {
        const val = Number(lake.distanceMiles);
        if (!isNaN(minDistance) && val < minDistance) return false;
        if (!isNaN(maxDistance) && val > maxDistance) return false;
      }

      const fromYear = this.filters.surveyYearFrom ? parseInt(this.filters.surveyYearFrom, 10) : NaN;
      const toYear = this.filters.surveyYearTo ? parseInt(this.filters.surveyYearTo, 10) : NaN;
      if (!isNaN(fromYear) || !isNaN(toYear)) {
        const sd = lake.surveyDate ? new Date(lake.surveyDate) : null;
        if (!sd) return false;
        const y = sd.getFullYear();
        if (!isNaN(fromYear) && y < fromYear) return false;
        if (!isNaN(toYear) && y > toYear) return false;
      }

      const minSize = this.filters.lakeSizeMin ? parseFloat(this.filters.lakeSizeMin) : NaN;
      const maxSize = this.filters.lakeSizeMax ? parseFloat(this.filters.lakeSizeMax) : NaN;
      if (!isNaN(minSize) || !isNaN(maxSize)) {
        const val = Number(lake.lakeSize);
        if (!isNaN(minSize) && val < minSize) return false;
        if (!isNaN(maxSize) && val > maxSize) return false;
      }

      const minT = this.filters.totalMin ? parseFloat(this.filters.totalMin) : NaN;
      const maxT = this.filters.totalMax ? parseFloat(this.filters.totalMax) : NaN;
      if (!isNaN(minT) || !isNaN(maxT)) {
        const val = Number(lake.fishlengths?.total) || 0;
        if (!isNaN(minT) && val < minT) return false;
        if (!isNaN(maxT) && val > maxT) return false;
      }

      return true;
    });
  }

  getAverageWeightOptions(): string[] {
    let max = 0;
    for (const lake of this.lakeTableData) {
      const v = Number(lake.speciesdata?.averageWeight);
      if (!isNaN(v) && v > max) max = v;
    }

    const maxStep = Math.ceil(max * 2) / 2;
    const opts: string[] = [];
    for (let v = 0; v <= maxStep; v = Math.round((v + 0.5) * 100) / 100) {
      opts.push(v.toFixed(1));
      if (v + 0.5 > maxStep) break;
    }
    return opts;
  }

  getLakeSizeOptions(): string[] {
    let max = 0;
    for (const lake of this.lakeTableData) {
      const v = Number(lake.lakeSize);
      if (!isNaN(v) && v > max) max = v;
    }

    const thresholds = [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000];
    const opts: number[] = [];
    for (const t of thresholds) {
      if (t <= max) opts.push(t);
    }
    if (max > thresholds[thresholds.length - 1]) opts.push(Math.ceil(max));

    return Array.from(new Set(opts)).sort((a, b) => a - b).map((n) => n.toString());
  }

  getSurveyYearOptions(): string[] {
    const set = new Set<number>();
    for (const lake of this.lakeTableData) {
      if (lake.surveyDate) {
        const year = new Date(lake.surveyDate).getFullYear();
        set.add(year);
      }
    }
    return Array.from(set).sort((a, b) => a - b).map((n) => n.toString());
  }

  clearFilters() {
    this.filters = {} as any;
    this.cdr.detectChanges();
  }

  private getSelectedSpeciesText(): string {
    const selected = this.species.find((s: any) => s.Id == this.speciesInput);
    return selected?.Species?.trim() ?? this.speciesInput?.trim() ?? '';
  }

  private highlightSpecies(content: string): string {
    const speciesText = this.getSelectedSpeciesText();
    if (!speciesText) {
      return content;
    }

    const escaped = speciesText.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    return content.replace(new RegExp('\\b(' + escaped + ')\\b', 'gi'), '<font size="5"><strong>$1</strong></font>');
  }

  public sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    const dir = this.sortDirection === 'asc' ? 1 : -1;

    const getValue = (lake: any) => {
      switch (column) {
        case 'name':
          return (lake.name || '').toString().toLowerCase();
        case 'averageWeight':
          return Number(lake.speciesdata?.averageWeight) || 0;
        case 'distance':
          return Number(lake.distanceMiles ?? Number.POSITIVE_INFINITY) || Number.POSITIVE_INFINITY;
        case 'surveyDate':
          return new Date(lake.surveyDate).getTime() || 0;
        case 'lakeSize':
          return Number(lake.lakeSize) || 0;
        case 'zero':
        case 'one':
        case 'two':
        case 'three':
        case 'four':
        case 'five':
        case 'six':
        case 'seven':
        case 'eight':
        case 'nine':
        case 'ten':
        case 'eleven':
        case 'twelve':
        case 'total':
          return Number(lake.fishlengths?.[column]) || 0;
        default:
          return 0;
      }
    };

    this.lakeTableData.sort((a: any, b: any) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    this.cdr.detectChanges();
  }
}
