// © 2025 City Pave. All Rights Reserved.
// Filename: config.js

import { activeConfig } from './firebase-config.js';

const appConfig = {
    citypave: {
        id: 'citypave',
        name: 'City Pave',
        logo_light: 'https://images.squarespace-cdn.com/content/v1/68406fe582974844d20a0b16/d1433f9a-1614-4f5e-8418-44f37be7804e/In+Partnership+with+DT+city+pave+logo+light+Background+copy.png?format=1500w',
        logo_dark: 'https://images.squarespace-cdn.com/content/v1/68406fe582974844d20a0b16/16d0a34e-2f35-4189-9ea6-b98de20aea49/In+Partnership+with+DT+city+pave+logo+Dark+Background+copy.png?format=1500w',
        phone: '(431) 482-5688',
        email: 'Info@citypave.ca',
        address: '9-2310 Logan Ave, Winnipeg, Manitoba, R2R 2T8',
        // ADDED: Shop Coordinates (Approximate for 2310 Logan Ave)
        shopLocation: { lat: 49.9236, lng: -97.2086 },
        firebase: activeConfig
    },
    dumptrux: {
        id: 'dumptrux',
        name: 'DumpTrux.ca Ltd.',
        logo_light: 'https://images.squarespace-cdn.com/content/v1/66a66882e4736d6a044cea97/e4676b4c-e3f5-4bc8-af2c-c4e7d1019d30/DumpTrux.ca+Ltd+logo+copy.png?format=1500w',
        logo_dark: 'https://images.squarespace-cdn.com/content/v1/66a66882e4736d6a044cea97/e4676b4c-e3f5-4bc8-af2c-c4e7d1019d30/DumpTrux.ca+Ltd+logo+copy.png?format=1500w',
        phone: '(204) 293-9742',
        email: 'info@dumptrux.ca',
        address: '9-2310 Logan Ave, Winnipeg, Manitoba, R2R 2T8',
        shopLocation: { lat: 49.9236, lng: -97.2086 },
        firebase: activeConfig
    }
};

const currentMode = localStorage.getItem('app_brand_mode') || 'citypave';
export const config = appConfig[currentMode];