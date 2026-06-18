import { Component, signal, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { staticcontent } from './global/globals';
import { Api } from './api';

interface Filters {
  averageWeightMin?: string;
  averageWeightMax?: string;
  surveyYearFrom?: string;
  surveyYearTo?: string;
  totalMin?: string;
  totalMax?: string;
  lakeSizeMin?: string;
  lakeSizeMax?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./app.css']
})
export class Home {
  protected readonly title = signal('LakeFinderMN');
  countyInput: number = 0;
  speciesInput: string = '';
  lakeArray: any[] = [];
  counties: { County: string; Id: number }[] = staticcontent.counties;
  species: { Species: string; Id: string }[] = staticcontent.Species;
  closeResult = '';

  fishtable: any[] = [];
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  searchstatus: string = '';
  currentcounty: string = '';
  lakeCount: string = '';
  countyCount: string = '';

  constructor(private apiService: Api, private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer) {}

  safeDialogContent: SafeHtml = '';

  private setStatus(message: string) {
    this.searchstatus = message;
    this.cdr.detectChanges();
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

  private async surveyLakes(county: number) {
    this.setStatus('retrieving lakes...');
    try {
      const lakes = await this.apiService.GetLakesByCounty(county);

      if (!lakes?.results?.length) {
        this.setStatus(`No lakes found in county ${county}.`);
        return;
      }

      this.setStatus(`Retrieved ${lakes.results.length} lake(s) for county ${county}.`);

      const speciesName = this.species.find((s: any) => s.Id == this.speciesInput)?.Species?.toLowerCase() ?? '';
      const filteredLakes = lakes.results.filter(
        (x: any) => x.fishSpecies && x.fishSpecies.length > 0 && x.fishSpecies[0].includes(speciesName)
      );

      if (!filteredLakes.length) {
        this.setStatus(`No lakes in county ${county} with species ${this.speciesInput}.`);
        return;
      }

      this.setStatus(`Filtered to ${filteredLakes.length} lake(s) for species ${this.speciesInput}.`);

      for (let index = 0; index < filteredLakes.length; index++) {
        const element = filteredLakes[index];
        this.currentcounty = element.county;
        this.setStatus(`retrieving data for Lake ${element.name} (${index + 1}/${filteredLakes.length})`);
        this.lakeCount = `(${index + 1}/${filteredLakes.length} lakes)`;

        const survey = await this.apiService.GetLakeData(element.id);

        if (!survey) {
          this.setStatus(`Failed to retrieve survey for Lake ${element.name}.`);
          continue;
        }

        if (survey.status !== 'SUCCESS' || survey.message !== 'Normal execution.') {
          this.setStatus(`No valid survey data for Lake ${element.name}.`);
          continue;
        }

        let surveyData = survey.result.surveys;
        surveyData.forEach((data: any) => {
          data.surveyDate = new Date(data.surveyDate);
        });
        surveyData.sort((a: any, b: any) => a.surveyDate - b.surveyDate);
        surveyData = surveyData.filter((x: any) => x.surveyType == 'Standard Survey');

        const latestSurvey = surveyData[surveyData.length - 1];
        if (!latestSurvey) {
          this.setStatus(`No standard survey available for Lake ${element.name}.`);
          continue;
        }

        let speciesdata = latestSurvey.fishCatchSummaries;
        speciesdata = speciesdata.filter((fish: any) => fish.species == this.speciesInput);
        if (!speciesdata.length) {
          this.setStatus(`No catch summary for ${this.speciesInput} in Lake ${element.name}.`);
          continue;
        }

        const fishlenarray = this.revealfishlengthstats(latestSurvey);
        if (fishlenarray[13] === 0) {
          this.setStatus(`Lake ${element.name} has no sampled fish lengths.`);
          continue;
        }

        this.fishtable.push({
          name: element.name,
          lakeSize: survey.result?.areaAcres ?? element.areaAcres ?? 'N/A',
          speciesdata: speciesdata[speciesdata.length - 1],
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
          lakeid: element.id,
          narrative: latestSurvey.narrative,
          waterAccess: element.point['epsg:4326']
        });
      }

      this.setStatus('Search complete!');
    } catch (err) {
      console.error(err);
      this.searchstatus = 'Error retrieving lake data.';
    }
  }

  private revealfishlengthstats(survey: any) {
    const fishlen: any[] = [];
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 0, 5));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 6, 7));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 8, 9));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 10, 11));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 12, 14));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 15, 19));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 20, 24));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 25, 29));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 30, 34));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 35, 39));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 40, 44));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 45, 49));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 50, 100));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput, 0, 100));
    return fishlen;
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

  dialogVisible = false;
  dialogContent = '';
  searched: boolean = false;

  async searchLakes(countyInput: number) {
    this.searched = true;
    this.setStatus('Initializing search...');
    this.currentcounty = '';
    this.lakeCount = '';
    this.countyCount = '';
    this.fishtable = [];

    if (countyInput === 0) {
      this.setStatus('Searching all counties...');
      for (let i = 1; i < 88; i++) {
        this.countyCount = `(${i}/87 counties)`;
        await this.surveyLakes(i);
      }
      this.setStatus('All counties search complete!');
    } else {
      await this.surveyLakes(countyInput);
    }
  }

  public openDialog(content: string) {
    this.dialogContent = content || 'No summary available.';
    const highlightedContent = this.highlightSpecies(this.dialogContent);
    this.safeDialogContent = this.sanitizer.bypassSecurityTrustHtml(highlightedContent);
    this.dialogVisible = true;
    this.cdr.detectChanges();
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

    this.fishtable.sort((a: any, b: any) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

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

  public closeDialog() {
    this.dialogVisible = false;
  }

  public saveAsPdf() {
    window.print();
  }

  // Per-column filters bound from header inputs
  filters: Filters = {};

  // Computed filtered table based on `filters` map.
  get filteredFishtable() {
    // If no filters are set, return full table
    const hasAny = Object.keys(this.filters).some((k) => {
      const v = (this.filters as any)[k];
      return v !== undefined && v !== null && v !== '';
    });
    if (!hasAny) return this.fishtable;

    return this.fishtable.filter((lake: any) => {
      // Average weight numeric range
      const minAW = this.filters.averageWeightMin ? parseFloat(this.filters.averageWeightMin) : NaN;
      const maxAW = this.filters.averageWeightMax ? parseFloat(this.filters.averageWeightMax) : NaN;
      if (!isNaN(minAW) || !isNaN(maxAW)) {
        const val = Number(lake.speciesdata?.averageWeight) || 0;
        if (!isNaN(minAW) && val < minAW) return false;
        if (!isNaN(maxAW) && val > maxAW) return false;
      }

      // Survey year range
      const fromYear = this.filters.surveyYearFrom ? parseInt(this.filters.surveyYearFrom, 10) : NaN;
      const toYear = this.filters.surveyYearTo ? parseInt(this.filters.surveyYearTo, 10) : NaN;
      if (!isNaN(fromYear) || !isNaN(toYear)) {
        const sd = lake.surveyDate ? new Date(lake.surveyDate) : null;
        if (!sd) return false;
        const y = sd.getFullYear();
        if (!isNaN(fromYear) && y < fromYear) return false;
        if (!isNaN(toYear) && y > toYear) return false;
      }

      // Lake size numeric range (acres)
      const minSize = this.filters.lakeSizeMin ? parseFloat(this.filters.lakeSizeMin) : NaN;
      const maxSize = this.filters.lakeSizeMax ? parseFloat(this.filters.lakeSizeMax) : NaN;
      if (!isNaN(minSize) || !isNaN(maxSize)) {
        const val = Number(lake.lakeSize);
        if (!isNaN(minSize) && val < minSize) return false;
        if (!isNaN(maxSize) && val > maxSize) return false;
      }

      // Total numeric range
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

  // Return unique options for a column to populate dropdowns in the header.
  getColumnOptions(column: string): string[] {
    const set = new Set<string>();
    for (const lake of this.fishtable) {
      let val: any = '';
      if (column === 'name') val = lake.name;
      else if (column === 'averageWeight') val = lake.speciesdata?.averageWeight;
      else if (column === 'surveyDate') val = lake.surveyDate ? new Date(lake.surveyDate).getFullYear() : '';
      else val = lake.fishlengths?.[column];

      if (val !== undefined && val !== null && val !== '') set.add(val.toString());
    }

    const arr = Array.from(set);
    // numeric sort when all values are numeric
    const allNumeric = arr.every((v) => !isNaN(Number(v)));
    if (allNumeric) return arr.map((v) => Number(v)).sort((a, b) => a - b).map((n) => n.toString());
    return arr.sort((a, b) => a.localeCompare(b));
  }

  // Generate average weight options from 0 to max in 0.5 increments
  getAverageWeightOptions(): string[] {
    let max = 0;
    for (const lake of this.fishtable) {
      const v = Number(lake.speciesdata?.averageWeight);
      if (!isNaN(v) && v > max) max = v;
    }
    const maxStep = Math.ceil(max * 2) / 2; // round up to nearest 0.5
    const opts: string[] = [];
    for (let v = 0; v <= maxStep; v = Math.round((v + 0.5) * 100) / 100) {
      opts.push(v.toFixed(1));
      if (v + 0.5 > maxStep) break;
    }
    return opts;
  }

  // Generate lake size (acres) options for dropdowns
  getLakeSizeOptions(): string[] {
    let max = 0;
    for (const lake of this.fishtable) {
      const v = Number(lake.lakeSize);
      if (!isNaN(v) && v > max) max = v;
    }

    // sensible threshold steps
    const thresholds = [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000];
    const opts: number[] = [];
    for (const t of thresholds) {
      if (t <= max) opts.push(t);
    }
    if (max > thresholds[thresholds.length - 1]) opts.push(Math.ceil(max));

    // ensure unique and sorted
    const uniq = Array.from(new Set(opts)).sort((a, b) => a - b);
    return uniq.map((n) => n.toString());
  }

  // Generate unique survey years from fishtable for dropdown
  getSurveyYearOptions(): string[] {
    const set = new Set<number>();
    for (const lake of this.fishtable) {
      if (lake.surveyDate) {
        const year = new Date(lake.surveyDate).getFullYear();
        set.add(year);
      }
    }
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.map((n) => n.toString());
  }

  public clearFilters() {
    this.filters = {} as any;
    this.cdr.detectChanges();
  }
}
