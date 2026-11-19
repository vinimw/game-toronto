import importlib.util
import json
import pathlib
import unittest

FILE = pathlib.Path(__file__).with_name('import_osm.py')
spec = importlib.util.spec_from_file_location('import_osm', FILE)
osm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(osm)


class ImporterTests(unittest.TestCase):
    def test_projection_orientation(self):
        origin = {'lat': 43.65, 'lon': -79.46}
        self.assertAlmostEqual(osm.project(43.65, -79.46, origin)[0], 0)
        self.assertGreater(osm.project(43.65, -79.459, origin)[0], 0)
        self.assertLess(osm.project(43.651, -79.46, origin)[1], 0)

    def test_convert_sample_osm(self):
        bbox = (43.645, -79.473, 43.654, -79.456)
        demo = {'elements': [
            {'type': 'way', 'tags': {'highway': 'footway', 'name': 'Sample'}, 'geometry': [
                {'lat': 43.65, 'lon': -79.468}, {'lat': 43.651, 'lon': -79.468}]},
            {'type': 'way', 'tags': {'building': 'yes', 'building:levels': '2'}, 'geometry': [
                {'lat': 43.65, 'lon': -79.46}, {'lat': 43.65, 'lon': -79.4599},
                {'lat': 43.6499, 'lon': -79.4599}, {'lat': 43.65, 'lon': -79.46}]}
        ]}
        out = osm.convert(demo, bbox)
        self.assertEqual(len(out['features']), 2)
        self.assertEqual([x['kind'] for x in out['features']], ['path', 'building'])
        self.assertEqual(out['features'][0]['name'], 'Sample')
        self.assertEqual(out['license'][:4], 'ODbL')
        self.assertLess(out['bbox'][0], out['bbox'][2])
        self.assertLess(out['bbox'][1], out['bbox'][3])

    def test_closed_ways_required_for_buildings(self):
        self.assertIsNone(osm.classify({'building': 'yes'}, False))
        self.assertEqual(osm.classify({'natural': 'water'}, True), 'water')

    def test_published_snapshot_rebuilds_from_original_node_coordinates(self):
        source = (osm.ROOT / 'tools/data/high-park-north.osm-source.json').read_bytes()
        raw = json.loads(source)
        published = json.loads(osm.OUTPUT.read_bytes())
        self.assertEqual(osm.convert_api(raw, source, osm.DEFAULT_BBOX), published)
        by_id = {f['osmId']: f for f in published['features']}
        nodes = {item['id']: item for item in raw['elements'] if item['type'] == 'node'}
        building = next(item for item in raw['elements'] if item['type'] == 'way' and item['id'] == 43805272)
        expected = [osm.project(nodes[node]['lat'], nodes[node]['lon'], published['origin']) for node in building['nodes']]
        self.assertEqual(by_id[43805272]['points'], expected)
        self.assertIn(174188399, by_id)
        self.assertEqual(published['coverage']['waysByClass']['water'], 0)
        west, north, east, south = published['bbox']
        for f in published['features']:
            for x, z in f['points']:
                self.assertTrue(west <= x <= east and north <= z <= south)

    def test_clip_line_keeps_discontinuous_parts(self):
        self.assertEqual(osm.clip_line([[-3, 0],[0, 0],[2, 0],[2, 1],[0, 1]], [-1,-1,1,2]),
                         [[[-1,0],[0,0],[1,0]],[[1,1],[0,1]]])


if __name__ == '__main__':
    unittest.main()
