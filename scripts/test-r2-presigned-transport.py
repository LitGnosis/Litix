#!/usr/bin/env python3
"""Synthetic only. No Cloudflare calls, credentials, or customer data."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit

PATH = Path(__file__).with_name("litix-r2-boto3-transfer.py")
spec = importlib.util.spec_from_file_location("litix_r2_transport", PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

HOST = "0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com"
KEY = "litix-backup-probes/probe-synthetic.bin"
BUCKET = "litix-private-backups"
SIGNED = "https://" + HOST + "/" + BUCKET + "/" + KEY + "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=fake-test-signature"

class FakeResponse:
    def __init__(self, status): self.status = status
    def read(self, _):
        if self.status == 400:
            return b"<Error><Code>InvalidArgument</Code><Message>Unsupported header x-amz-sdk-checksum-algorithm</Message></Error>"
        return b""

class FakeConnection:
    status = 200
    latest = None
    def __init__(self, host, timeout): self.host=host;self.timeout=timeout;self.headers={};self.body=bytearray();self.path=None;self.closed=False;type(self).latest=self
    def putrequest(self, method, path, skip_accept_encoding=False):
        assert method=="PUT" and skip_accept_encoding;self.path=path
    def putheader(self, key, value): self.headers[key]=value
    def endheaders(self): pass
    def send(self, chunk): self.body.extend(chunk)
    def getresponse(self): return FakeResponse(type(self).status)
    def close(self): self.closed=True

class FakeClient:
    def __init__(self, url=SIGNED): self.url=url;self.calls=[]
    def generate_presigned_url(self, op, Params, ExpiresIn, HttpMethod):
        self.calls.append((op,Params,ExpiresIn,HttpMethod))
        return self.url

class PresignedTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/"probe.bin"
        self.path.write_bytes(b"secure synthetic test only"*6)
        self.env=patch.dict(os.environ, {"R2_ENDPOINT":"https://"+HOST})
        self.env.start()
        self.http=patch.object(mod.http.client,"HTTPSConnection",FakeConnection)
        self.http.start()
        FakeConnection.status=200
    def tearDown(self): self.http.stop();self.env.stop();self.temp.cleanup()
    def test_streamed_content_length_and_allowlisted_host(self):
        fake=FakeClient()
        mod.presigned_put(fake,BUCKET,KEY,self.path)
        c=FakeConnection.latest
        self.assertEqual(c.host,HOST)
        self.assertEqual(c.headers["Content-Length"],str(self.path.stat().st_size))
        self.assertEqual(bytes(c.body),self.path.read_bytes())
        self.assertEqual(len(fake.calls),1)
        self.assertEqual(fake.calls[0][3],"PUT")
        self.assertTrue(c.closed)
    def test_never_follows_untrusted_signature_target(self):
        fake=FakeClient(SIGNED.replace(HOST,"untrusted.invalid"))
        with self.assertRaises(ValueError): mod.presigned_put(fake,BUCKET,KEY,self.path)
    def test_http_error_rejected_without_logging_signed_url(self):
        FakeConnection.status=403
        with self.assertRaisesRegex(RuntimeError,"PRESIGNED_HTTP_403"):
            mod.presigned_put(FakeClient(),BUCKET,KEY,self.path)

    def test_safe_xml_classification_never_uses_response_body_as_log(self):
        FakeConnection.status=400
        with self.assertRaisesRegex(RuntimeError,"PRESIGNED_HTTP_400_InvalidArgument_UNSUPPORTED_CHECKSUM"):
            mod.presigned_put(FakeClient(),BUCKET,KEY,self.path)

if __name__ == "__main__": unittest.main()
