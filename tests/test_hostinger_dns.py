import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import hostinger_dns as dns


class HostingerSafetyTests(unittest.TestCase):
    def setUp(self):
        self.row = {'id': 'test', 'hostname': 'www.researchbyexample.com', 'verification_hostname': 'researchbyexample.com', 'aliases': ['researchbyexample.com'], 'verification_token': 'public-proof'}
        self.records = [
            {'name': '@', 'type': 'A', 'ttl': 14400, 'records': [{'content': '192.0.2.2'}]},
            {'name': 'www', 'type': 'CNAME', 'ttl': 14400, 'records': [{'content': 'old.example.com'}]},
            {'name': '@', 'type': 'MX', 'ttl': 14400, 'records': [{'content': 'mail.example.com', 'priority': 10}]},
            {'name': '@', 'type': 'TXT', 'ttl': 14400, 'records': [{'content': 'v=spf1 -all'}]},
            {'name': '_brilliancy', 'type': 'TXT', 'ttl': 300, 'records': [{'content': 'another-proof'}]},
        ]

    def test_prepare_only_appends_ownership_txt_on_existing_website(self):
        original = copy.deepcopy(self.records)
        with patch.object(dns, 'request', return_value=self.records) as api, patch.object(dns, 'snapshot') as backup:
            dns.prepare(self.row)
            backup.assert_called_once_with('researchbyexample.com', original)
        self.assertEqual(self.records, original)
        self.assertEqual(api.call_args.args, ('researchbyexample.com', 'PUT', {'overwrite': False, 'zone': [{'name': '_brilliancy', 'type': 'TXT', 'ttl': 300, 'records': [{'content': 'public-proof'}]}]}))

    def test_prepare_is_idempotent(self):
        self.records[-1]['records'].append({'content': '"public-proof"'})
        with patch.object(dns, 'request', return_value=self.records) as api, patch.object(dns, 'snapshot') as backup:
            dns.prepare(self.row)
            self.assertEqual(api.call_count, 1)
            backup.assert_not_called()

    def test_conflicting_proof_cname_is_not_replaced(self):
        self.records.append({'name': '_brilliancy', 'type': 'CNAME', 'records': [{'content': 'other.example.com'}]})
        with patch.object(dns, 'request', return_value=self.records) as api:
            with self.assertRaises(ValueError): dns.prepare(self.row)
            self.assertEqual(api.call_count, 1)

    def test_no_launch_without_exact_allowlist(self):
        with patch.dict(os.environ, {'BRILLIANCY_GO_LIVE_DOMAINS': ''}), patch.object(dns, 'request') as api:
            with self.assertRaisesRegex(ValueError, 'paused'): dns.connect_dns(self.row, '187.127.210.231')
            api.assert_not_called()

    def test_existing_website_dns_is_not_repointed(self):
        with patch.dict(os.environ, {'BRILLIANCY_GO_LIVE_DOMAINS': 'researchbyexample.com'}), patch.object(dns, 'request', return_value=self.records) as api:
            with self.assertRaisesRegex(ValueError, 'reviewed migration'): dns.connect_dns(self.row, '187.127.210.231')
            self.assertEqual(api.call_count, 1)

    def test_new_domain_adds_only_two_website_record_sets(self):
        records = self.records[2:]
        with patch.dict(os.environ, {'BRILLIANCY_GO_LIVE_DOMAINS': 'researchbyexample.com'}), patch.object(dns, 'request', return_value=records) as api, patch.object(dns, 'snapshot'):
            dns.connect_dns(self.row, '187.127.210.231')
            payload = api.call_args.args[2]
            self.assertFalse(payload['overwrite'])
            self.assertEqual([(r['name'], r['type']) for r in payload['zone']], [('@','A'),('www','CNAME')])

    def test_ipv6_is_not_silently_deleted(self):
        records = [{'name':'@','type':'AAAA','records':[{'content':'2001:db8::1'}]}]
        with patch.dict(os.environ, {'BRILLIANCY_GO_LIVE_DOMAINS': 'researchbyexample.com'}), patch.object(dns, 'request', return_value=records) as api:
            with self.assertRaises(ValueError): dns.connect_dns(self.row, '187.127.210.231')
            self.assertEqual(api.call_count, 1)

    def test_subdomain_or_mismatched_pair_cannot_target_parent_zone(self):
        for fields in [{'hostname':'www.attacker.com'}, {'verification_hostname':'nested.example.com'}, {'aliases':[]}]:
            with self.assertRaises(ValueError): dns.root_for({**self.row, **fields})

    def test_provider_errors_never_reveal_token_or_response(self):
        error = urllib.error.HTTPError('https://developers.hostinger.com', 401, 'private-provider-body', {}, None)
        with patch.object(dns, 'read_token', return_value='synthetic-secret'), patch.object(dns.urllib.request, 'build_opener') as opener:
            opener.return_value.open.side_effect = error
            with self.assertRaises(ValueError) as raised: dns.request('researchbyexample.com')
            self.assertNotIn('synthetic-secret', str(raised.exception))
            self.assertNotIn('private-provider-body', str(raised.exception))
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, 'https://developers.hostinger.com/api/dns/v1/zones/researchbyexample.com')
            self.assertEqual(request.get_header('User-agent'), 'Brilliancy-Domain-Setup/1.0')

    def test_redirects_cannot_forward_authorization_to_another_host(self):
        self.assertIsNone(dns.NoRedirect().redirect_request(None,None,302,'',{},'https://attacker.example'))

    def test_snapshot_is_local_and_keeps_zone_for_recovery(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'HOSTINGER_DNS_BACKUP_DIR': folder}):
            dns.snapshot('researchbyexample.com', self.records)
            saved = list(Path(folder).glob('*.json'))
            self.assertEqual(len(saved), 1)
            self.assertEqual(json.loads(saved[0].read_text())['records'], self.records)


if __name__ == '__main__': unittest.main()
