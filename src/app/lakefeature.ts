import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { staticcontent } from './global/globals';
import { Api } from './api';

@Component({
  selector: 'lake-feature',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lakefeature.html',
  styleUrls: ['./lakefeature.css']
})
export class LakeFeature {
  countyInput = 0;
  publicAccessInput = 'Any';
  waterClarityInput = 'Any';
  maxDepthInput = 'Any';
  meanDepthInput = 'Any';
  lakeSizeInput = 'Any';
  searchStatus = '';
  lakeSurveys: any[] = [];
  lakeFeatureResults: Array<{
    name: string;
    'lake size': string | number | null;
    'water clarity': string | number | null;
    'Max depth': string | number | null;
    'Mean depth': string | number | null;
    'Public access': 'Yes' | 'No';
  }> = [];
  sortColumn = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  counties = staticcontent.counties;
  publicAccessOptions = ['Any', 'Yes', 'No'];
  waterClarityOptions = ['Any', '0-5 ft', '6-10 ft', '11-15 ft', '16-20 ft'];
  maxDepthOptions = ['Any', '0-10 ft', '11-20 ft', '21-30 ft', '31+ ft'];
  meanDepthOptions = ['Any', '0-5 ft', '6-10 ft', '11-15 ft', '16-20 ft', '21-30 ft', '31+ ft'];
  lakeSizeOptions = ['Any', '<100 acres', '100-500 acres', '500-1000 acres', '1000+ acres'];

  constructor(private apiService: Api, private cdr: ChangeDetectorRef) {}

  private maxDepthValue(option: string): number {
    switch (option) {
      case '0-10 ft': return 10;
      case '11-20 ft': return 20;
      case '21-30 ft': return 30;
      case '31+ ft': return Number.POSITIVE_INFINITY;
      default: return 0;
    }
  }

  private meanDepthValue(option: string): number {
    switch (option) {
      case '0-5 ft': return 5;
      case '6-10 ft': return 10;
      case '11-15 ft': return 15;
      case '16-20 ft': return 20;
      case '21-30 ft': return 30;
      case '31+ ft': return Number.POSITIVE_INFINITY;
      default: return 0;
    }
  }

  public isMeanDepthOptionAllowed(option: string): boolean {
    if (option === 'Any' || this.maxDepthInput === 'Any') {
      return true;
    }
    return this.meanDepthValue(option) <= this.maxDepthValue(this.maxDepthInput);
  }

  public onMaxDepthChange(value: string): void {
    this.maxDepthInput = value;
    if (!this.isMeanDepthOptionAllowed(this.meanDepthInput)) {
      this.meanDepthInput = 'Any';
    }
  }

  public onMeanDepthChange(value: string): void {
    if (this.isMeanDepthOptionAllowed(value)) {
      this.meanDepthInput = value;
    } else {
      this.meanDepthInput = 'Any';
    }
  }

  public sortByColumn(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortResults();
  }

  private sortResults(): void {
    this.lakeFeatureResults.sort((a, b) => {
      const valueA = a[this.sortColumn as keyof typeof a];
      const valueB = b[this.sortColumn as keyof typeof b];

      if (valueA === valueB) {
        return 0;
      }

      const parseNumber = (value: unknown): number | null => {
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          const normalized = value.replace(/[^0-9.-]/g, '');
          const parsed = Number(normalized);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const numA = parseNumber(valueA);
      const numB = parseNumber(valueB);
      let comparison = 0;

      if (numA !== null && numB !== null) {
        comparison = numA - numB;
      } else {
        comparison = String(valueA ?? '').localeCompare(String(valueB ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  public async searchByCounty(): Promise<void> {
    this.searchStatus = 'Searching lakes by county...';
    this.lakeSurveys = [];

    try {
      const result = await this.apiService.GetLakesByCounty(this.countyInput);
      const lakes = result?.results ?? [];
      if (!lakes.length) {
        this.searchStatus = 'No lakes found for the selected county.';
        return;
      }

      this.searchStatus = `Found ${lakes.length} lake(s). Retrieving survey data...`;
      this.lakeFeatureResults = [];
      for (const lake of lakes) {
        try {
          const lakeData = await this.apiService.GetLakeData(lake.id);
          if (lakeData?.result?.surveys?.length) {
            this.lakeSurveys.push({ lake, lakeData });

            const survey = lakeData.result?.surveys?.[0] ?? {};
            const lakeName = lake.name ?? `Lake ${lake.id}`;
            const areaAcres = lakeData.result?.areaAcres ?? null;
            const averageWaterClarity = lakeData.result?.averageWaterClarity ?? null;
            const maxDepthFeet = lakeData.result?.maxDepthFeet ?? lakeData.result?.maxDepth ?? null;
            const meanDepthFeet = lakeData.result?.meanDepthFeet ?? lakeData.result?.meanDepth ?? null;
            const publicAccess = (lakeData.result?.accesses?.length ?? 0) > 0 ? 'Yes' : 'No';

            this.lakeFeatureResults.push({
              name: lakeName,
              'lake size': areaAcres,
              'water clarity': averageWaterClarity,
              'Max depth': maxDepthFeet,
              'Mean depth': meanDepthFeet,
              'Public access': publicAccess,
            });
          } else {
            console.warn(`Lake ${lake.id} has no survey data and will be skipped.`);
          }
        } catch (lakeError) {
          console.error(`Failed to load survey data for lake ${lake.id}:`, lakeError);
        }
      }

      if (this.sortColumn) {
        this.sortResults();
      }
      this.searchStatus = `Loaded survey data for ${this.lakeFeatureResults.length} lake(s).`;
      this.cdr.detectChanges();
    } catch (error) {
      console.error(error);
      this.searchStatus = 'Error retrieving lake data.';
      this.cdr.detectChanges();
    }
  }
}
