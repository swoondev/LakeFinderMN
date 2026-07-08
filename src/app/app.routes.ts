import { Routes } from '@angular/router';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', loadComponent: () => import('./home').then(m => m.Home) },
	{ path: 'lakefeature', loadComponent: () => import('./lakefeature').then(m => m.LakeFeature) },
	{ path: 'lakesearch', loadComponent: () => import('./search-by-lake').then(m => m.SearchByLake) }
];
