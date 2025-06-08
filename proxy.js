addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
  });
  
  async function handleRequest(request) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400", // 24 hours
        }
      });
    }

    // Parse the request URL
    const requestUrl = new URL(request.url);
    
    // Get the full query string
    const queryString = requestUrl.search;
    
    // Extract the target URL more carefully to preserve all query parameters
    // Look for "url=" at the beginning (after "?") or "&url=" elsewhere
    const urlParamPos = queryString.indexOf("url=");
    
    // If "url=" is found, extract everything after it
    const urlParam = urlParamPos >= 0 
      ? queryString.substring(urlParamPos + 4) // Length of "url=" is 4
      : requestUrl.searchParams.get("url"); // Fallback to the old method
    
    // If no URL is provided, return an error response
    if (!urlParam) {
      return new Response("Missing 'url' parameter. Usage: https://edl-proxy.gabriel-briffe.workers.dev/?url=https://www.edl-soaring.com/mbtiles/extract_mbtiles_from_date.php?fdate=2025-03-27+00:00:00&isobare=90000", {
        status: 400,
        headers: { 
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    
    // Decode the URL parameter
    const url = decodeURIComponent(urlParam);
    
    try {
      // Log the URL being fetched (helpful for debugging)
      console.log(`Proxy fetching: ${url}`);
      
      // Fetch the requested URL
      const response = await fetch(url);
  
      // Check if the fetch was successful
      if (!response.ok) {
        return new Response(`Failed to fetch ${url}: ${response.statusText}`, {
          status: response.status,
          headers: { 
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
  
      // Create a headers object to preserve important headers
      const headers = new Headers({
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Access-Control-Allow-Origin": "*", // Allow any origin to access this
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Disposition": response.headers.get("Content-Disposition") || "attachment" // Preserve filename if provided
      });
      
      // Preserve caching and version headers
      const preserveHeaders = [
        'ETag', 
        'Last-Modified', 
        'Cache-Control', 
        'Date', 
        'Content-Length'
      ];
      
      // Add the preserved headers to our response
      for (const header of preserveHeaders) {
        const value = response.headers.get(header);
        if (value) {
          headers.set(header, value);
          console.log(`Preserving header: ${header}: ${value}`);
        }
      }
  
      // Return the fetched content with CORS headers and preserved headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
    } catch (error) {
      return new Response(`Error fetching ${url}: ${error.message}`, {
        status: 500,
        headers: { 
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }