"""Điền bản sao OOXML, giữ nguyên styles, bảng, relationships và các phần khác.
Giao tiếp nội bộ: JSON qua stdin; JSON preview hoặc bytes Office qua stdout.
Chỉ dùng Python standard library, không cần cài package.
"""
import copy
import math
import html
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent / 'templates'
FILES = {'proposal': '01_mauA.I.4.docx', 'feasibility': '02_TT-1.docx', 'eia': '03_BaoCao_DTM_2026.docx', 'estimate': '04_DuToan_SanNen_TongMucDauTu.xlsx'}
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS = {'w': W, 's': S}
NATIONAL = r'CỘNG H(?:OÀ|ÒA|OA) XÃ HỘI'
ET.register_namespace('w', W)
ET.register_namespace('x', S)


def text(p):
    return ''.join(t.text or '' for t in p.iter(f'{{{W}}}t'))


def clear_fill_tabs(p):
    # Dấu tab chấm dẫn tới mép phải ở các ô trống .doc sẽ đẩy giá trị ra ngoài giấy.
    for run in p.findall('w:r', NS):
        for tab in run.findall('w:tab', NS):
            run.remove(tab)


def replace_text(p, old, new):
    # Placeholder có thể bị Word chia ra nhiều run; chỉ sửa phần text liên quan.
    nodes = list(p.iter(f'{{{W}}}t'))
    joined = ''.join(t.text or '' for t in nodes)
    start = joined.find(old)
    if start < 0:
        return
    clear_fill_tabs(p)
    end, pos, inserted = start + len(old), 0, False
    for t in nodes:
        s = t.text or ''
        a, b = pos, pos + len(s)
        if b > start and a < end:
            t.text = s[:max(0, start - a)] + (new if not inserted else '') + s[max(0, end - a):]
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            inserted = True
        pos = b


def append_text(p, value):
    clear_fill_tabs(p)
    run = ET.SubElement(p, f'{{{W}}}r')
    first = p.find('w:r/w:rPr', NS)
    if first is not None:
        run.append(copy.deepcopy(first))
    node = ET.SubElement(run, f'{{{W}}}t')
    node.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    node.text = ' ' + value


def bold_prefix(p, length):
    pos = 0
    for run in list(p.findall('w:r', NS)):
        value = text(run)
        props = run.find('w:rPr', NS)
        if props is None:
            props = ET.Element(f'{{{W}}}rPr')
            run.insert(0, props)
        bold = props.find('w:b', NS)
        if bold is None:
            bold = ET.SubElement(props, f'{{{W}}}b')
        bold.set(f'{{{W}}}val', '1' if pos < length else '0')
        # Tách đúng ranh giới nhãn và giá trị, không làm đậm cả đoạn diễn giải.
        if pos < length < pos + len(value):
            after = copy.deepcopy(run)
            split = length - pos
            for target, part in [(run, value[:split]), (after, value[split:])]:
                for child in list(target):
                    if child.tag != f'{{{W}}}rPr':
                        target.remove(child)
                ET.SubElement(target, f'{{{W}}}t', {'{http://www.w3.org/XML/1998/namespace}space': 'preserve'}).text = part
            after.find('w:rPr/w:b', NS).set(f'{{{W}}}val', '0')
            p.insert(list(p).index(run) + 1, after)
        pos += len(value)


def format_document(doc, kind, labels):
    body = doc.find('w:body', NS)
    if kind == 'proposal':
        # Bắt đầu ngay từ quốc hiệu, bỏ nhãn mẫu và chú thích phạm vi áp dụng.
        children = list(body)
        start = next((i for i, child in enumerate(children) if re.search(NATIONAL, text(child))), None)
        if start is not None:
            for child in children[:start]:
                body.remove(child)
    for p in doc.findall('.//w:p', NS):
        value = text(p).strip()
        label = labels.get(id(p), '').strip()
        if re.search(NATIONAL, value) and 'Độc lập' in value:
            # Mẫu .doc chứa hai dòng trong cùng một paragraph.
            split = value.index('Độc lập')
            for child in list(p):
                if child.tag != f'{{{W}}}pPr':
                    p.remove(child)
            run = ET.SubElement(p, f'{{{W}}}r')
            ET.SubElement(run, f'{{{W}}}t').text = value[:split].strip()
            ET.SubElement(run, f'{{{W}}}br')
            ET.SubElement(run, f'{{{W}}}t').text = value[split:].strip()
        full_bold = bool(re.match(r'^(?:[IVX]+\.\s|CHƯƠNG\s|MỞ ĐẦU$|TÓM TẮT|KẾT LUẬN|PHỤ LỤC|ĐỀ XUẤT DỰ ÁN ĐẦU TƯ$|TỜ TRÌNH$|Thẩm định Báo cáo|BÁO CÁO ĐÁNH GIÁ|ĐẠI DIỆN TỔ CHỨC|CHỦ DỰ ÁN \(Ký)', value))
        full_bold = full_bold or bool(re.search(NATIONAL, value)) or 'Độc lập - Tự do - Hạnh phúc' in value or label.startswith('TÊN TỔ CHỨC') or value == 'Nhà đầu tư'
        if full_bold:
            length = len(text(p))
        elif re.match(r'^\d+(?:\.\d+)*\.\s', value):
            colon = label.find(':')
            if colon >= 0 and value.startswith(label[:colon + 1]):
                length = colon + 1
            elif label and value.startswith(label):
                length = len(label)
            else:
                colon = value.find(':')
                missing = value.find('[Cần bổ sung:')
                length = colon + 1 if colon >= 0 and (missing < 0 or colon < missing) else 0
        else:
            length = 0
        # Cùng font với hồ sơ cũ, cả preview lẫn Word; bỏ font theme ghi đè.
        for run in p.findall('.//w:r', NS):
            props = run.find('w:rPr', NS)
            if props is None:
                props = ET.Element(f'{{{W}}}rPr'); run.insert(0, props)
            fonts = props.find('w:rFonts', NS)
            if fonts is None:
                fonts = ET.SubElement(props, f'{{{W}}}rFonts')
            fonts.attrib.clear()
            for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
                fonts.set(f'{{{W}}}{attr}', 'Times New Roman')
            size = props.find('w:sz', NS)
            if size is None:
                size = ET.SubElement(props, f'{{{W}}}sz')
            size.set(f'{{{W}}}val', '28')
        bold_prefix(p, length)
    # Bảng số liệu có dòng tiêu đề đậm; bảng đầu/chữ ký không kẻ khung.
    tables = doc.findall('.//w:tbl', NS)
    for table in tables:
        head = text(table).strip()
        if 'CỘNG HÒA XÃ HỘI' in head or 'Nhà đầu tư' in head and len(table.findall('w:tr', NS)) == 1 or 'ĐẠI DIỆN TỔ CHỨC' in head:
            props = table.find('w:tblPr', NS)
            if props is None:
                props = ET.Element(f'{{{W}}}tblPr'); table.insert(0, props)
            borders = props.find('w:tblBorders', NS)
            if borders is None:
                borders = ET.SubElement(props, f'{{{W}}}tblBorders')
            for side in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
                ET.SubElement(borders, f'{{{W}}}{side}', {f'{{{W}}}val': 'nil'})
            if re.search(NATIONAL, head):
                for size in table.findall('.//w:rPr/w:sz', NS):
                    size.set(f'{{{W}}}val', '22')
        else:
            first = table.find('w:tr', NS)
            if first is not None:
                for p in first.findall('.//w:p', NS):
                    bold_prefix(p, len(text(p)))


def fill_doc(kind, values, sections, edits, extra, sources=None):
    z = zipfile.ZipFile(ROOT / FILES[kind])
    doc = ET.fromstring(z.read('word/document.xml'))
    labels = {id(p): text(p) for p in doc.findall('.//w:p', NS)}
    # Các đường gạch giữ chỗ trong mẫu không phải nội dung văn bản.
    for node in doc.findall('.//w:t', NS):
        if node.text:
            node.text = re.sub(r'_{3,}', '', node.text)
    def v(key):
        value = values.get(key)
        if value is None or value == '':
            return f'[Cần bổ sung: {key}]'
        if isinstance(value, (float, int)):
            return f'{value:,.2f}'.rstrip('0').rstrip('.').replace(',', '_').replace('.', ',').replace('_', '.')
        return str(value)

    def narrative(key):
        return v(key) if values.get(key) not in (None, '') else sections.get(key, v(key))

    derived = {
        'coordinates': v('coordinates') + ' (' + v('crs') + ')',
        'area': v('site_area') + ' m²', 'cut': v('cut_volume') + ' m³', 'fill': v('fill_volume') + ' m³',
        'import': (v_number(max(0, values['fill_volume'] - values['cut_volume'])) if all(isinstance(values.get(k), (float, int)) for k in ['cut_volume', 'fill_volume']) else '[Cần bổ sung: khối lượng đào/đắp]') + ' m³',
        'road_area': v('road_area') + ' m²', 'drain': v('drain_length') + ' m', 'wastewater': v('ww_capacity') + ' m³/ngày',
        'building_works': f"{v('building_type')}; diện tích chiếm đất {v('building_footprint')} m²; tổng sàn {v('floor_area')} m²; {v('floors')} tầng; cao {v('building_height')} m",
        'design_rainfall': v('rain_intensity') + ' mm/h',
    }
    proposal = {
        'I. TÊN NHÀ ĐẦU TƯ': 'investor', '1.1. Tên dự án': 'project_name', '1.2. Địa điểm thực hiện dự án': 'project_location',
        '2. Mục tiêu dự án': 'objectives', '3. Quy mô dự án': None,
        '4.1. Tổng vốn đầu tư': 'total_investment', '4.2. Nguồn vốn đầu tư': 'capital_plan',
        '5. Thời hạn hoạt động': 'operating_term', '6. Tiến độ thực hiện': 'duration', '7. Nhu cầu về lao động': 'expected_jobs',
        '8. Đánh giá tác động': 'socioeconomic', '9. Thông tin về đất đai': 'land_explanation',
        '10. Giải trình về sự phù hợp': 'planning_explanation', '11. Đánh giá sơ bộ tác động môi trường': 'eia_impacts',
        '12. Giải trình việc đáp ứng': 'foreign_conditions', '13. Giải trình về việc đáp ứng': 'investment_conditions',
        'III. ĐỀ XUẤT ƯU ĐÃI': 'incentives',
    }
    feasibility = {
        '1. Tên dự án:': 'project_name', '2. Nhóm dự án:': 'project_group',
        '3. Loại và cấp công trình': None, '4. Người quyết định đầu tư:': 'decider', '5. Chủ đầu tư': None,
        '6. Địa điểm xây dựng:': 'project_location', '7. Giá trị tổng mức đầu tư:': 'total_investment', '8. Nguồn vốn đầu tư:': 'capital_source',
        '9. Tiến độ': 'duration', '10. Tiêu chuẩn': 'standards', '11. Nhà thầu lập': 'designer', '12. Nhà thầu khảo sát': 'surveyor',
        '13. Nhà thầu thẩm tra': 'reviewer', '14. Các thông tin khác': None, '15. Phạm vi trình thẩm định': 'appraisal_scope',
        '1. Văn bản pháp lý:': 'legal_basis', '2. Tài liệu khảo sát': 'attachments', '3. Hồ sơ năng lực': 'contractor_capacity',
    }
    for p in doc.findall('.//w:p', NS):
        original = text(p).strip()
        if kind in ('proposal', 'feasibility') and 'ngày' in original and re.match(r'^[. …]+,?\s*ngày', original):
            parts = str(values.get('issue_date', '')).split('-')
            date = f'ngày {parts[2]} tháng {parts[1]} năm {parts[0]}' if len(parts) == 3 else v('issue_date')
            replace_text(p, text(p), v('document_place') + ', ' + date)
        if kind == 'proposal' and original.startswith('Ngày ....'):
            replace_text(p, text(p), v('issue_date') + ')')
        if kind == 'eia':
            for match in list(re.finditer(r'{{\s*(\w+)\s*}}', text(p))):
                key = match[1]
                replace_text(p, match[0], derived.get(key, narrative(key)))
        elif kind == 'proposal':
            for prefix, key in proposal.items():
                if original.startswith(prefix):
                    value = (f"Diện tích khu đất {v('site_area')} m²; {derived['building_works']}; sản phẩm/công suất: {v('products')}.") if key is None else narrative(key)
                    append_text(p, value)
                    break
            if original.startswith('- Diện tích đất phù hợp quy hoạch'):
                replace_text(p, text(p), '- Diện tích đất phù hợp quy hoạch: ' + v('planning_compatible_area') + ' m²; căn cứ: ' + v('planning_approval'))
            direct = {
                '- Diện tích đất, mặt nước': f"- Diện tích đất dự kiến sử dụng: {v('site_area')} m².",
                '- Công suất thiết kế': '- Công suất thiết kế: ' + v('products'),
                '- Sản phẩm, dịch vụ': '- Sản phẩm/dịch vụ: ' + v('products'),
                '- Quy mô kiến trúc': '- Quy mô kiến trúc: ' + derived['building_works'],
                '- Diện tích đất xây dựng:': '- Diện tích chiếm đất xây dựng: ' + v('building_footprint') + ' m²',
                '- Diện tích sàn xây dựng nhà ở:': '- Diện tích sàn: ' + v('floor_area') + ' m² (cần phân loại phần nhà ở)',
                '- Loại nhà ở': '- Loại nhà ở: ' + v('housing_type'),
                '- Số lượng nhà ở:': '- Số lượng nhà ở: ' + v('units') + ' căn',
                '- Quy mô dân số:': '- Quy mô dân số: ' + v('population') + ' người',
                '- Vị trí dự án thuộc khu vực đô thị:': '- Thuộc khu vực đô thị: ' + v('urban_status'),
                '- Dự án thuộc phạm vi bảo vệ': '- Thuộc phạm vi bảo vệ di tích: ' + v('heritage_status'),
                '- Dự án thuộc khu vực hạn chế': '- Thuộc khu vực hạn chế phát triển/nội đô lịch sử: ' + v('restricted_development_status'),
                '4.1. Tổng vốn đầu tư:': f"4.1. Tổng vốn đầu tư: {v('total_investment')} VND; tương đương {v('investment_usd')} USD; nguồn/ngày tỷ giá: {v('exchange_rate_source')}",
                '- Vốn góp của nhà đầu tư:': '- Vốn góp của nhà đầu tư: ' + v('equity_capital') + ' VND',
                '+ Vốn vay từ': '+ Vốn vay tổ chức tín dụng: ' + v('loan_capital') + ' VND',
                '+ Vốn huy động từ cổ đông': '+ Vốn huy động cổ đông/thành viên: ' + v('capital_plan'),
                '+ Vốn huy động từ nguồn khác': '+ Vốn huy động nguồn khác: ' + v('other_capital') + ' VND',
                '- Lợi nhuận để lại': '- Lợi nhuận để lại tái đầu tư: ' + v('reinvested_profit') + ' VND',
            }
            for prefix, value in direct.items():
                if original.startswith(prefix):
                    replace_text(p, text(p), value)
                    break
            if original.startswith('a) Hiện trạng sử dụng đất'):
                append_text(p, f"{v('land_type')}; thửa {v('land_number')}, tờ bản đồ {v('map_number')}; tứ cận: {v('boundaries')}")
            if original.startswith('Từng nhà đầu tư ký'):
                append_text(p, v('signer'))
        else:
            for prefix, key in feasibility.items():
                if original.startswith(prefix):
                    detail = f"{v('building_type')}, cấp {v('building_grade')}; thời hạn thiết kế {v('design_life')}" if prefix.startswith('3. Loại') else f"{v('investor')}; {v('contact')}" if prefix.startswith('5.') else derived['building_works']
                    append_text(p, v(key) if key else detail)
                    break
            for old, new in [('TÊN TỔ CHỨC', v('investor')), ('(Tên tổ chức)', v('investor')), ('(Cơ quan chuyên môn về xây dựng)', v('recipient')), ('(Tên công trình/dự án)', v('project_name'))]:
                for _ in range(text(p).count(old)):
                    replace_text(p, old, new)
            if original.startswith('Số:'):
                replace_text(p, text(p), 'Số: ' + v('document_number'))
            if original.startswith('Căn cứ ') or original.startswith('Các căn cứ pháp lý'):
                replace_text(p, text(p), 'Căn cứ: ' + v('legal_basis') if original.startswith('Căn cứ Luật') else '' if values.get('legal_basis') else '[Cần đối chiếu căn cứ pháp lý trong template trước khi phát hành]')
            if original == 'ĐẠI DIỆN TỔ CHỨC':
                append_text(p, v('signer'))
    # Các bảng nhà đầu tư/mục tiêu của A.I.4 vẫn giữ số hàng/cột gốc.
    if kind == 'proposal':
        for table in doc.findall('.//w:tbl', NS):
            rows = table.findall('w:tr', NS)
            if rows and text(rows[0]).startswith('STT'):
                count = 2 if len(rows[0].findall('w:tc', NS)) == 6 else 1
                for row in rows[:count]:
                    props = row.find('w:trPr', NS)
                    if props is None:
                        props = ET.SubElement(row, f'{{{W}}}trPr')
                    ET.SubElement(props, f'{{{W}}}cantSplit')
                    ET.SubElement(props, f'{{{W}}}tblHeader')
                    for p in row.findall('.//w:p', NS):
                        pp = p.find('w:pPr', NS)
                        if pp is None:
                            pp = ET.SubElement(p, f'{{{W}}}pPr')
                        ET.SubElement(pp, f'{{{W}}}keepNext')
            for row in rows:
                cells = row.findall('w:tc', NS)
                if cells and text(cells[0]).strip() == '1':
                    for i, cell in enumerate(cells[1:]):
                        ps = cell.findall('w:p', NS)
                        if ps:
                            row_values = [narrative('objectives'), v('vsic_code'), v('cpc_code')] if len(cells) == 4 else [v('investor'), v('equity_capital'), v('equity_usd'), v('equity_percent'), v('contribution_method'), v('contribution_schedule')]
                            value = row_values[i]
                            replace_text(ps[0], text(ps[0]), value) if text(ps[0]) else append_text(ps[0], value)
    if kind == 'eia':
        for p in doc.findall('.//w:p', NS):
            original = text(p).strip()
            for prefix, key in [('3.4. Đánh giá mức độ tin cậy', 'reliability_assessment'), ('CHƯƠNG 4.', 'restoration_plan'), ('CHƯƠNG 5.', 'green_classification'), ('KẾT LUẬN, KIẾN NGHỊ VÀ CAM KẾT', 'conclusion')]:
                if original.startswith(prefix):
                    append_text(p, v(key))
        # Nguồn trong bảng phải phản ánh module thực tế, không giữ nhãn LiDAR của mẫu.
        keys = {'Diện tích dự án': 'site_area', 'Đào đất': 'cut_volume', 'Đắp đất': 'fill_volume', 'Diện tích đường nội bộ': 'road_area', 'Thoát nước mưa': 'drain_length'}
        for table in doc.findall('.//w:tbl', NS):
            for row in table.findall('w:tr', NS):
                cells = row.findall('w:tc', NS)
                key = keys.get(text(cells[0]).strip()) if cells else None
                if key and len(cells) == 3:
                    p = cells[2].find('w:p', NS)
                    source = (sources or {}).get(key, {})
                    value = source.get('source', 'Cần xác minh nguồn') + ' · ' + source.get('status', 'unverified')
                    replace_text(p, text(p), value)
    paragraphs = doc.findall('.//w:p', NS)
    indexes = {id(p): i for i, p in enumerate(paragraphs)}
    for key, value in (edits or {}).items():
        if not str(key).isdigit() or int(key) >= len(paragraphs) or not isinstance(value, str) or len(value) > 30000:
            raise ValueError('Chỉnh sửa đoạn văn không hợp lệ')
        p = paragraphs[int(key)]
        if text(p):
            replace_text(p, text(p), value)
        elif value:
            append_text(p, value)
    body = doc.find('w:body', NS)
    for value in extra or []:
        if not isinstance(value, str) or len(value) > 20000:
            raise ValueError('Đoạn bổ sung không hợp lệ')
        p = ET.Element(f'{{{W}}}p')
        append_text(p, value)
        body.insert(max(0, len(body) - 1), p)
    if kind == 'proposal':
        # Bản .doc gốc có ngắt trang và các đoạn trống sau chữ ký.
        for node in list(body)[::-1]:
            if node.tag == f'{{{W}}}sectPr':
                continue
            if node.tag == f'{{{W}}}p' and not text(node).strip() and node.find('.//w:drawing', NS) is None:
                body.remove(node)
            else:
                break
    format_document(doc, kind, labels)
    data = ET.tostring(doc, encoding='utf-8', xml_declaration=True)
    return package(z, {'word/document.xml': data}), preview(doc, indexes)


def preview(doc, indexes=None):
    indexes = indexes or {id(p): i for i, p in enumerate(doc.findall('.//w:p', NS))}
    def inline(run):
        content = ''
        for node in run:
            if node.tag == f'{{{W}}}t':
                content += html.escape(node.text or '').replace('\n', '<br>')
            elif node.tag == f'{{{W}}}br':
                content += '<br>'
            elif node.tag == f'{{{W}}}tab':
                content += ' '
        for prop, tag in [('b', 'strong'), ('i', 'em'), ('u', 'u')]:
            flag = run.find(f'w:rPr/w:{prop}', NS)
            if flag is not None and flag.get(f'{{{W}}}val', '1') not in ('0', 'false', 'none'):
                content = f'<{tag}>' + content + f'</{tag}>'
        if run.find('w:rPr/w:vertAlign', NS) is not None:
            align = run.find('w:rPr/w:vertAlign', NS).get(f'{{{W}}}val')
            if align in ('superscript', 'subscript'):
                tag = 'sup' if align == 'superscript' else 'sub'
                content = f'<{tag}>' + content + f'</{tag}>'
        return content
    def render(node):
        tag = node.tag.split('}')[-1]
        if tag == 'p':
            ppr = node.find('w:pPr', NS)
            align = ppr.find('w:jc', NS).get(f'{{{W}}}val') if ppr is not None and ppr.find('w:jc', NS) is not None else 'left'
            content = ''.join(inline(run) for run in node.findall('w:r', NS))
            value = text(node).strip()
            cls = 'qh' if re.search(NATIONAL, value) else 'tn' if value.startswith('Độc lập') else 'ten-loai' if value in ('TỜ TRÌNH', 'ĐỀ XUẤT DỰ ÁN ĐẦU TƯ', 'BÁO CÁO ĐÁNH GIÁ TÁC ĐỘNG MÔI TRƯỜNG') else ''
            key = f'data-tp="{indexes[id(node)]}"' if id(node) in indexes else 'data-extra="true"'
            return f'<p {key} class="{cls}" style="text-align:{align if align in ("left", "right", "center", "justify") else "left"}">{content or "<br>"}</p>'
        if tag == 'tbl':
            value = text(node)
            cls = 'vb-head' if re.search(NATIONAL, value) else 'vb-foot' if 'ĐẠI DIỆN TỔ CHỨC' in value or 'Nhà đầu tư' in value and len(node.findall('w:tr', NS)) == 1 else 'vb-tb'
            return f'<table class="{cls}">' + ''.join(render(c) for c in node if c.tag.endswith('}tr')) + '</table>'
        if tag in ('tr', 'tc'):
            name = 'tr' if tag == 'tr' else 'td'
            return f'<{name}>' + ''.join(render(c) for c in node if c.tag.split('}')[-1] in ('p', 'tbl', 'tc')) + f'</{name}>'
        return ''
    return '<div class="vb" data-page="A4">' + ''.join(render(c) for c in doc.find('w:body', NS)) + '</div>'


def v_number(n):
    return f'{n:,.2f}'.replace(',', '_').replace('.', ',').replace('_', '.')


def package(z, changes):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as target:
        for entry in z.infolist():
            target.writestr(entry, changes.get(entry.filename, z.read(entry.filename)))
    return out.getvalue()


def fill_xlsx(values, sources):
    z = zipfile.ZipFile(ROOT / FILES['estimate'])
    changes = {}
    styles = ET.fromstring(z.read('xl/styles.xml'))
    xfs = styles.find('s:cellXfs', NS)
    style_cache = {}
    def input_style(original, decimal):
        key = (original, decimal)
        if key not in style_cache:
            xf = copy.deepcopy(xfs[int(original or 0)])
            alignment = xf.find('s:alignment', NS)
            if alignment is None:
                alignment = ET.SubElement(xf, f'{{{S}}}alignment')
            alignment.set('wrapText', '1')
            alignment.set('vertical', 'center')
            if decimal:
                xf.set('numFmtId', '2')  # 0.00; hệ số 0.5 không được hiển thị thành 1.
                xf.set('applyNumberFormat', '1')
            style_cache[key] = str(len(xfs))
            xfs.append(xf)
        return style_cache[key]
    def update(sheet, mapping):
        path = f'xl/worksheets/sheet{sheet}.xml'
        root = ET.fromstring(z.read(path))
        data = root.find('s:sheetData', NS)
        for address, value in mapping.items():
            c = root.find(f'.//s:c[@r="{address}"]', NS)
            if c is None:
                rownum = re.search(r'\d+', address)[0]
                row = data.find(f's:row[@r="{rownum}"]', NS)
                if row is None:
                    row = ET.SubElement(data, f'{{{S}}}row', {'r': rownum})
                c = ET.SubElement(row, f'{{{S}}}c', {'r': address})
            for child in list(c):
                c.remove(child)
            c.attrib.pop('t', None)
            if value is None:
                continue
            if isinstance(value, (int, float)):
                ET.SubElement(c, f'{{{S}}}v').text = str(value)
            else:
                c.set('t', 'inlineStr')
                ET.SubElement(ET.SubElement(c, f'{{{S}}}is'), f'{{{S}}}t').text = str(value)
            c.set('s', input_style(c.get('s'), isinstance(value, float) and sheet == 1 and address not in ['C20', 'C21', 'C22', 'C23', 'C24']))
            rownum = re.search(r'\d+', address)[0]
            row = data.find(f's:row[@r="{rownum}"]', NS)
            if row is not None and isinstance(value, str):
                height = 15 * max(1, math.ceil(len(value) / (70 if address.startswith('F') else 28)))
                row.set('ht', str(max(float(row.get('ht', '15')), height)))
                row.set('customHeight', '1')
        # Ô thêm vào phải theo thứ tự cột cho Excel/LibreOffice.
        for row in data:
            row[:] = sorted(row, key=lambda c: (len(re.sub(r'\d', '', c.get('r', ''))), re.sub(r'\d', '', c.get('r', ''))))
        changes[path] = ET.tostring(root, encoding='utf-8', xml_declaration=True)
    keys = ['site_area', 'building_footprint', 'floor_area', 'road_area', 'green_area', 'technical_area', 'cut_volume', 'fill_volume', 'drain_length', 'water_pipe_length', 'duration_months', 'ww_capacity', 'expected_jobs', 'land_cost', 'equipment_cost', 'pm_rate', 'consult_rate', 'other_rate', 'quantity_reserve', 'price_reserve', 'rain_intensity', 'runoff_coeff', 'crs']
    inputs = {}
    for i, k in enumerate(keys, 5):
        inputs[f'C{i}'] = values.get(k)
        inputs[f'E{i}'] = sources.get(k, {}).get('source', 'Cần bổ sung')
        if values.get(k) is None:
            inputs[f'F{i}'] = f'CẦN BỔ SUNG: {k}'
    update(1, inputs)
    prices = {}
    for i, code in enumerate(['SN_DAO', 'SN_DAP', 'SN_CAPDAT', 'GT_DUONG', 'TN_CONG', 'CN_ONG', 'XD_XUONG', 'CX_CANHQUAN'], 6):
        p = values.get('unit_prices', {}).get(code, {})
        prices[f'D{i}'] = p.get('value')
        prices[f'E{i}'] = p.get('source', 'CẦN BỔ SUNG đơn giá và nguồn')
        prices[f'F{i}'] = 'Chưa xác minh' if p else 'Thiếu'
    update(2, prices)
    work_keys = ['cut_volume', 'fill_volume', None, 'road_area', 'drain_length', 'water_pipe_length', 'floor_area', 'green_area']
    update(3, {f'H{i}': sources.get(k, {}).get('source', 'Cần bổ sung') if k else 'max(0, đắp − đào); chưa xét hệ số vật liệu' for i, k in enumerate(work_keys, 6)})
    update(5, {f'D{i}': sources.get(k, {}).get('source', 'Cần bổ sung') for i, k in enumerate(['building_footprint', 'road_area', 'green_area', 'technical_area'], 6)})
    missing = [k for k in keys if values.get(k) is None]
    update(6, {'B10': values.get('terrain_validation') or 'CẦN BỔ SUNG', 'B11': 'CHƯA XÁC MINH', 'B12': values.get('planning_approval') or 'CẦN BỔ SUNG', 'A14': 'Đầu vào thiếu: ' + (', '.join(missing) or 'không; vẫn cần xác minh nguồn')})
    # Không để cache 0/OK của file mẫu tạo cảm giác đã đủ dữ liệu.
    for i in range(1, 7):
        path = f'xl/worksheets/sheet{i}.xml'
        root = ET.fromstring(changes.get(path, z.read(path)))
        for c in root.findall('.//s:c', NS):
            f = c.find('s:f', NS)
            if f is not None:
                value = c.find('s:v', NS)
                if value is not None:
                    c.remove(value)
                # Công thức kiểm tra cũng phải chỉ rõ thiếu đầu vào, không coi blank là 0.
                old = f.text
                f.text = f'IF(COUNTBLANK(Dau_vao!C5:C27)+COUNTBLANK(Don_gia!D6:D13)>0,"CẦN BỔ SUNG",{old})' if i == 6 else f'IF(COUNTBLANK(Dau_vao!C5:C27)+COUNTBLANK(Don_gia!D6:D13)>0,"",{old})'
        setup = root.find('s:pageSetup', NS)
        if setup is None:
            setup = ET.SubElement(root, f'{{{S}}}pageSetup')
        setup.attrib.update({'orientation': 'landscape', 'paperSize': '8', 'fitToWidth': '1', 'fitToHeight': '0'})
        props = root.find('s:sheetPr', NS)
        if props is None:
            props = ET.Element(f'{{{S}}}sheetPr')
            root.insert(0, props)
        fit = props.find('s:pageSetUpPr', NS)
        if fit is None:
            fit = ET.SubElement(props, f'{{{S}}}pageSetUpPr')
        fit.set('fitToPage', '1')
        changes[path] = ET.tostring(root, encoding='utf-8', xml_declaration=True)
    xfs.set('count', str(len(xfs)))
    changes['xl/styles.xml'] = ET.tostring(styles, encoding='utf-8', xml_declaration=True)
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    calc = wb.find('s:calcPr', NS)
    if calc is None:
        calc = ET.SubElement(wb, f'{{{S}}}calcPr')
    calc.set('fullCalcOnLoad', '1')
    calc.set('forceFullCalc', '1')
    calc.set('calcMode', 'auto')
    changes['xl/workbook.xml'] = ET.tostring(wb, encoding='utf-8', xml_declaration=True)
    return package(z, changes)


if __name__ == '__main__':
    req = json.load(sys.stdin)
    kind = req['type']
    if kind not in FILES:
        raise ValueError('Loại template không hỗ trợ')
    packet = req['input']
    if kind == 'estimate':
        sys.stdout.buffer.write(fill_xlsx(packet['values'], packet['sources']))
    else:
        binary, html_preview = fill_doc(kind, packet['values'], req.get('sections', {}), req.get('edits', {}), req.get('extra', []), packet['sources'])
        if req.get('preview'):
            print(json.dumps({'html': html_preview}, ensure_ascii=False))
        else:
            sys.stdout.buffer.write(binary)
