import fs from 'node:fs/promises';
import { REPORT_FIELDS, REPORT_NUMBERS, PRICE_CODES, emptyReportInputs } from '../src/lib/report-input.js';

await fs.mkdir('examples', { recursive: true });
const properties = Object.fromEntries([
  ...Object.entries(REPORT_FIELDS).map(([key, description]) => [key, { type: ['string', 'null'], description }]),
  ...Object.entries(REPORT_NUMBERS).map(([key, unit]) => [key, { type: ['number', 'null'], ...(!key.includes('elevation') ? { minimum: 0 } : {}), ...(unit === '0..1' ? { maximum: 1 } : key === 'equity_percent' ? { maximum: 100 } : {}), description: unit }]),
]);
properties.model_scope.enum = ['twin', 'cad', 'map', null];
properties.unit_prices = { type: 'object', additionalProperties: false, properties: Object.fromEntries(PRICE_CODES.map((key) => [key, {
  type: 'object', required: ['value', 'source'], additionalProperties: false,
  properties: { value: { type: 'number', minimum: 0 }, source: { type: 'string', minLength: 1 } },
}])) };
const schema = { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Input bổ sung hồ sơ AIPM', type: 'object', additionalProperties: false, properties };
await fs.writeFile('examples/report-input.schema.json', JSON.stringify(schema, null, 2) + '\n');
await fs.writeFile('examples/report-input.json', JSON.stringify(emptyReportInputs({}), null, 2) + '\n');
console.log('Đã ghi examples/report-input.json và schema.');
