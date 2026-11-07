import importlib.util
import io
import unittest
import zipfile
from pathlib import Path
from xml.etree import ElementTree as E

spec = importlib.util.spec_from_file_location('templates', Path(__file__).parents[1] / 'server/templates.py')
templates = importlib.util.module_from_spec(spec)
spec.loader.exec_module(templates)


class TemplatesTest(unittest.TestCase):
    def test_docx_fill_and_preserve_package(self):
        for kind in ['proposal', 'feasibility', 'eia']:
            data, preview = templates.fill_doc(kind, {'project_name': 'DỰ ÁN THỬ', 'investor': 'Đơn vị A', 'site_area': 179.35}, {}, {}, [])
            with zipfile.ZipFile(io.BytesIO(data)) as out, zipfile.ZipFile(templates.ROOT / templates.FILES[kind]) as source:
                for entry in source.namelist():
                    if entry != 'word/document.xml':
                        self.assertEqual(out.read(entry), source.read(entry), entry)
                xml = out.read('word/document.xml').decode()
                self.assertIn('DỰ ÁN THỬ', xml)
                self.assertNotIn('{{', xml)
                self.assertIn('[Cần bổ sung:', xml)
                E.fromstring(xml)
            self.assertIn('data-tp=', preview)

    def test_edited_preview_is_exported(self):
        data, _ = templates.fill_doc('eia', {}, {}, {'0': 'Nội dung đã sửa <&>'}, ['Đoạn bổ sung'])
        with zipfile.ZipFile(io.BytesIO(data)) as out:
            doc = E.fromstring(out.read('word/document.xml'))
            self.assertIn('Nội dung đã sửa <&>', templates.text(doc))
            self.assertIn('Đoạn bổ sung', templates.text(doc))

    def test_report_fonts_headings_and_proposal_start(self):
        for kind in ['proposal', 'feasibility', 'eia']:
            data, preview = templates.fill_doc(kind, {'project_name': 'Dự án A', 'investor': 'Chủ đầu tư A'}, {}, {}, [])
            with zipfile.ZipFile(io.BytesIO(data)) as out:
                doc = E.fromstring(out.read('word/document.xml'))
                for font in doc.findall('.//w:r/w:rPr/w:rFonts', templates.NS):
                    self.assertEqual(font.get(f'{{{templates.W}}}ascii'), 'Times New Roman')
                self.assertIn('<strong>', preview)
                if kind == 'proposal':
                    body = doc.find('w:body', templates.NS)
                    self.assertTrue(templates.text(body[0]).startswith('CỘNG HOÀ'))
                    self.assertNotIn('Mẫu A.I.4', preview)
                    self.assertNotIn('Dự án không thuộc diện chấp thuận', preview)
                    self.assertIn('<br>', preview)
                    # Chỉ số paragraph vẫn theo template gốc để giữ các chỉnh sửa đã lưu.
                    self.assertIn('data-tp="4"', preview)
                if kind == 'feasibility':
                    self.assertIn('class="vb-head"', preview)
                    self.assertNotIn('___', preview)
                    self.assertIn('<strong>TỜ TRÌNH</strong>', preview)

    def test_xlsx_numbers_sources_and_missing_guards(self):
        data = templates.fill_xlsx({'site_area': 179.35, 'technical_area': 0, 'unit_prices': {'SN_DAO': {'value': 50000, 'source': 'Đơn giá gốc'}}}, {})
        with zipfile.ZipFile(io.BytesIO(data)) as out:
            root = E.fromstring(out.read('xl/worksheets/sheet1.xml'))
            self.assertEqual(root.find('.//s:c[@r="C5"]/s:v', templates.NS).text, '179.35')
            self.assertEqual(root.find('.//s:c[@r="C10"]/s:v', templates.NS).text, '0')
            self.assertIsNone(root.find('.//s:c[@r="C11"]/s:v', templates.NS))
            calc = E.fromstring(out.read('xl/workbook.xml')).find('s:calcPr', templates.NS)
            self.assertEqual(calc.get('fullCalcOnLoad'), '1')
            for i in range(3, 7):
                root = E.fromstring(out.read(f'xl/worksheets/sheet{i}.xml'))
                for c in root.findall('.//s:c', templates.NS):
                    if c.find('s:f', templates.NS) is not None:
                        self.assertIn('COUNTBLANK', c.find('s:f', templates.NS).text)
                        self.assertIsNone(c.find('s:v', templates.NS))



if __name__ == '__main__':
    unittest.main()
