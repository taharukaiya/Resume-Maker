/** Generates configuration only; never edits the host proxy or DNS. */
export function vpsDomainConfig(hostname: string, existingProxy: boolean) {
  if (
    !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      hostname,
    )
  )
    throw new Error("Invalid researcher hostname.");
  return `${existingProxy ? `http://${hostname}:8080` : hostname} {
    encode zstd gzip
    @read method GET HEAD
    handle @read {
        rewrite * /website/${hostname}{uri}
        reverse_proxy web:3000 {
            header_up -Cookie
            header_down -Set-Cookie
        }
    }
    handle {
        respond "Method not allowed." 405
    }
}`;
}
