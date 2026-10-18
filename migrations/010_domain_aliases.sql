ALTER TABLE domains ADD COLUMN verification_hostname text;
ALTER TABLE domains ADD COLUMN redirect_to text REFERENCES domains(hostname);
CREATE INDEX domains_redirect_to ON domains(redirect_to);
