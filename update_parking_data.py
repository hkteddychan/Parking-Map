#!/usr/bin/env python3
"""
LCSD Parking Map — 每分鐘更新腳本
抓取 TD 和 NMOSPIOT API，更新 parking-data.json，然後 push 到 GitHub
"""
import urllib.request
import json
import csv
import os
import sys
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
GITHUB_TOKEN = os.environ.get('GIT_TOKEN', '')

HEADERS = {'User-Agent': 'Mozilla/5.0'}

URLS = {
    'carpark_basic': 'https://resource.data.one.gov.hk/td/carpark/basic_info_all.json',
    'carpark_vacancy': 'https://resource.data.one.gov.hk/td/carpark/vacancy_all.json',
    'onstreet_space': 'https://data.nmospiot.gov.hk/api/pvds/Download/parkingspace',
    'onstreet_occ': 'https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus',
}

def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    return json.loads(urllib.request.urlopen(req, timeout=15).read())

def fetch_csv_text(url):
    req = urllib.request.Request(url, headers=HEADERS)
    return urllib.request.urlopen(req, timeout=15).read().decode('utf-8')

def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching parking data...")

    # Fetch all 4 sources in parallel-ish
    cp_basic = fetch_json(URLS['carpark_basic'])
    cp_vacancy = fetch_json(URLS['carpark_vacancy'])
    os_space_raw = fetch_csv_text(URLS['onstreet_space'])
    os_occ_raw = fetch_csv_text(URLS['onstreet_occ'])

    # Index vacancy
    vac_index = {}
    for v in cp_vacancy.get('car_park', []):
        pid = v.get('park_id')
        for vt in v.get('vehicle_type', []):
            if vt.get('type') == 'P':
                for sc in vt.get('service_category', []):
                    if sc.get('category') == 'HOURLY':
                        vac_index[pid] = sc.get('vacancy')

    # Merge car parks
    car_parks = []
    for cp in cp_basic.get('car_park', []):
        pid = cp.get('park_id')
        car_parks.append({
            'park_id': pid,
            'name_en': cp.get('name_en'),
            'name_tc': cp.get('name_tc'),
            'name_sc': cp.get('name_sc'),
            'displayAddress_en': cp.get('displayAddress_en'),
            'displayAddress_tc': cp.get('displayAddress_tc'),
            'displayAddress_sc': cp.get('displayAddress_sc'),
            'latitude': cp.get('latitude'),
            'longitude': cp.get('longitude'),
            'district_en': cp.get('district_en'),
            'district_tc': cp.get('district_tc'),
            'district_sc': cp.get('district_sc'),
            'contactNo': cp.get('contactNo'),
            'opening_status': cp.get('opening_status'),
            'height': cp.get('height'),
            'remark_en': cp.get('remark_en'),
            'remark_tc': cp.get('remark_tc'),
            'remark_sc': cp.get('remark_sc'),
            'website_en': cp.get('website_en'),
            'website_tc': cp.get('website_tc'),
            'website_sc': cp.get('website_sc'),
            'carpark_photo': cp.get('carpark_photo'),
            'vacancy': vac_index.get(pid),
            'type': 'carpark',
            'status': None,
        })

    # Parse onstreet CSVs
    os_lines = os_space_raw.strip().split('\n')
    os_header_idx = next(i for i, l in enumerate(os_lines) if l.startswith('FeatureID'))
    os_reader = csv.DictReader(os_lines[os_header_idx:])
    os_space = list(os_reader)

    occ_lines = os_occ_raw.strip().split('\n')
    occ_header_idx = next(i for i, l in enumerate(occ_lines) if l.startswith('FeatureID'))
    occ_reader = csv.DictReader(occ_lines[occ_header_idx:])
    occ_map = {r['ParkingSpaceId']: r for r in occ_reader}

    onstreet = []
    for s in os_space:
        occ = occ_map.get(s.get('ParkingSpaceId'), {})
        status = occ.get('OccupancyStatus', 'NU')
        lat = s.get('Latitude')
        lng = s.get('Longitude')
        if not lat or not lng:
            continue
        onstreet.append({
            'park_id': f"osm_{s.get('ParkingSpaceId')}",
            'name_tc': s.get('SectionOfStreet_tc') or s.get('Street_tc') or s.get('ParkingSpaceId'),
            'name_en': s.get('SectionOfStreet') or s.get('Street') or s.get('ParkingSpaceId'),
            'address_tc': s.get('SectionOfStreet_tc') or s.get('Street_tc') or '',
            'address_en': s.get('SectionOfStreet') or s.get('Street') or '',
            'latitude': float(lat),
            'longitude': float(lng),
            'district_tc': s.get('District_tc') or '',
            'district_en': s.get('District') or '',
            'region_tc': s.get('Region_tc') or '',
            'status': status,
            'vacancy': 1 if status == 'V' else (0 if status == 'O' else None),
            'type': 'onstreet',
            'last_change': occ.get('OccupancyDateChanged', ''),
            'vehicle_type': s.get('VehicleType'),
        })

    output = {'car_parks': car_parks, 'onstreet': onstreet}

    # Save
    out_path = os.path.join(BASE, 'parking-data.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(out_path)
    green = sum(1 for cp in car_parks if isinstance(cp.get('vacancy'), (int, float)) and cp['vacancy'] > 0)
    red = sum(1 for cp in car_parks if cp.get('vacancy') == 0)
    gray = sum(1 for cp in car_parks if cp.get('vacancy') is None)
    os_v = sum(1 for os in onstreet if os['status'] == 'V')
    os_o = sum(1 for os in onstreet if os['status'] == 'O')
    print(f"  ✅ Saved {len(car_parks)} carparks, {len(onstreet)} onstreet | {size:,} bytes")
    print(f"  CP: {green}有位, {red}滿, {gray}無 | OS: {os_v}V, {os_o}O")

    # Git commit + push (only if GIT_TOKEN available)
    if GITHUB_TOKEN:
        os.chdir(BASE)
        os.system('git add parking-data.json')
        commit_msg = f"Auto-update: {datetime.now().strftime('%H:%M')}"
        os.system(f'git commit -m {repr(commit_msg)}')
        remote = f'https://{GITHUB_TOKEN}@github.com/hkteddychan/Parking-Map.git'
        os.system(f'git push origin master > /dev/null 2>&1')
        print(f"  ✅ Pushed to GitHub")
    else:
        print(f"  ⚠️  No GIT_TOKEN, skipping push")

if __name__ == '__main__':
    main()
