import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("reconciler", Path(__file__).parents[1] / "scripts/vps-domain-reconcile.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DomainSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.compose, self.proxy = root / "compose", root / "proxy"
        (self.compose / "domains").mkdir(parents=True)
        self.proxy.mkdir()
        self.addCleanup(patch.stopall)
        patch.object(module, "COMPOSE", self.compose).start()
        patch.object(module, "TRAEFIK", self.proxy).start()

    def test_existing_site_is_never_overwritten(self):
        legacy = self.proxy / "main.yaml"
        legacy.write_text('rule: Host(`researchbyexisting.com`)')
        with self.assertRaisesRegex(ValueError, "existing hosting route"):
            module.check_conflicts("researchbyexisting.com", set())
        self.assertEqual(legacy.read_text(), 'rule: Host(`researchbyexisting.com`)')

    def test_dns_mismatch_cannot_write_routes(self):
        with patch.object(module.socket, "getaddrinfo", return_value=[(None, None, None, None, ("203.0.113.9", 443))]):
            with self.assertRaisesRegex(ValueError, "A record"):
                module.reconcile({"hostname": "researchbynew.com", "status": "queued"}, "187.127.210.231")
        self.assertEqual(list(self.proxy.iterdir()), [])

    def test_builtin_fallbacks_allow_new_domains_but_unknown_wildcards_do_not(self):
        config = {"http": {"routers": {
            "https-error-page": {"rule": "HostRegexp(`.+`)", "priority": 1, "service": "easypanel"},
            "http-easypanel-ip": {"rule": "HostRegexp(`^[0-9.]+$`)", "priority": 2, "service": "easypanel"},
            "existing": {"rule": "Host(`researchbyexisting.com`)", "service": "old-site"}
        }}}
        legacy = self.proxy / "main.yaml"
        original = json.dumps(config)
        legacy.write_text(original)
        module.check_conflicts("researchbynew.com", set())
        self.assertEqual(legacy.read_text(), original)
        with self.assertRaises(ValueError):
            module.check_conflicts("researchbyexisting.com", set())
        config["http"]["routers"]["https-error-page"]["service"] = "legacy-site"
        legacy.write_text(json.dumps(config))
        with self.assertRaises(ValueError):
            module.check_conflicts("researchbynew.com", set())

    def test_only_exact_new_host_routes_are_generated(self):
        key, _, _ = module.domain_files("researchbynew.com")
        config = module.proxy_config("researchbynew.com", key)
        self.assertEqual(config["http"]["routers"][key]["rule"], "Host(`researchbynew.com`)")
        self.assertTrue(config["http"]["services"][key]["loadBalancer"]["passHostHeader"])
        with self.assertRaises(ValueError):
            module.domain_files("../../main.yaml")

    def test_invalid_caddy_configuration_is_not_activated(self):
        with patch.object(module.socket, "getaddrinfo", return_value=[(None, None, None, None, ("187.127.210.231", 443))]), patch.object(module, "worker", return_value="bad config"), patch.object(module, "command", side_effect=RuntimeError("invalid")):
            with self.assertRaises(RuntimeError):
                module.reconcile({"hostname": "researchbynew.com", "status": "queued"}, "187.127.210.231")
        self.assertEqual(list((self.compose / "domains").iterdir()), [])
        self.assertEqual(list(self.proxy.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
