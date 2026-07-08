import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchByLake } from './search-by-lake';
import { Api } from './api';

describe('SearchByLake', () => {
  let component: SearchByLake;
  let fixture: ComponentFixture<SearchByLake>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchByLake],
      providers: [
        {
          provide: Api,
          useValue: {
            GetLakeByName: jasmine.createSpy('GetLakeByName'),
            GetLakeData: jasmine.createSpy('GetLakeData')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SearchByLake);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render a fish species dropdown', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const speciesSelect = compiled.querySelector('#species-select');

    expect(speciesSelect).toBeTruthy();
    expect(speciesSelect?.textContent).toContain('Select species');
  });

  it('should calculate zero distance for the same coordinates', () => {
    const distance = component.getDistanceMiles(44.98, -93.26, 44.98, -93.26);

    expect(distance).toBeCloseTo(0, 5);
  });

  it('should filter rows by distance range', () => {
    component.lakeTableData = [
      { name: 'A', distanceMiles: 5, speciesdata: {}, fishlengths: { total: 1 }, surveyDate: new Date('2020-01-01'), lakeSize: 100 },
      { name: 'B', distanceMiles: 20, speciesdata: {}, fishlengths: { total: 1 }, surveyDate: new Date('2020-01-01'), lakeSize: 100 }
    ];
    component.filters = { distanceMin: '10', distanceMax: '30' } as any;

    const filtered = component.filteredLakeTableData;

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('B');
  });
});
