import { Component, signal, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import {staticcontent} from './global/globals';
import { Api } from './api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('LakeFinderMN');
  countyInput: number = 0;
  speciesInput: string = "";
  lakeArray: any[] = [];
  counties: {County: string, Id: number}[] = staticcontent.counties;
  species: {Species: string, Id: string}[] = staticcontent.Species;
  closeResult = '';

  fishtable: any[] = [];
  searchstatus: string = ""
  currentcounty: string = ""
  lakeCount: string = ""
  countyCount: string = ""

  constructor(private apiService: Api, private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer) { }

  safeDialogContent: SafeHtml = '';

  private setStatus(message: string) {
    this.searchstatus = message;
    this.cdr.detectChanges();
  }

  public GoToLake(lakeid: number){
    window.open("https://www.dnr.state.mn.us/lakefind/lake.html?id=" + lakeid,'_blank');
  }

  public GoToWaterAccess(lakeid: number){
    window.open("https://www.dnr.state.mn.us/lakefind/was/report.html?id=" + lakeid, '_blank');
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
      const filteredLakes = lakes.results.filter((x: any) => x.fishSpecies && x.fishSpecies.length > 0 && x.fishSpecies[0].includes(speciesName));

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
          narrative: latestSurvey.narrative
        });
      }

      this.setStatus('Search complete!');
    } catch (err) {
      console.error(err);
      this.searchstatus = 'Error retrieving lake data.';
    }
  }

  private revealfishlengthstats(survey: any){
    let fishlen: any[] = [];
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,0,5));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,6,7));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,8,9));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,10,11));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,12,14));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,15,19));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,20,24));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,25,29));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,30,34));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,35,39));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,40,44));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,45,49));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,50,100));
    fishlen.push(this.GetLengthCount(survey, this.speciesInput,0,100));
    return fishlen;
  }

  private GetLengthCount(survey: any, species: string, min: number, max: number) {
    let count = 0;
    if(survey.lengths[species] != undefined){
      for (let i = 0; i<survey.lengths[species].fishCount.length; i++){
        if (survey.lengths[species].fishCount[i][0] >= min && survey.lengths[species].fishCount[i][0] <= max){
          count += survey.lengths[species].fishCount[i][1];
        }
      }
    }
    return count;

  }

  dialogVisible = false;
  dialogContent = '';

  async searchLakes(countyInput: number) {
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
    return content.replace(new RegExp('\\b(' + escaped + ')\\b', 'gi'), '<font size = "5"><strong>$1</strong></font>');
  }

  public closeDialog() {
    this.dialogVisible = false;
  }

}
