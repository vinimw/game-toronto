import importlib.util
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


if __name__ == '__main__':
    unittest.main()
