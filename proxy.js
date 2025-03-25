addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
  });
  
  async function handleRequest(request) {
    // Parse the request URL
    const requestUrl = new URL(request.url);
    
    // Get the full query string
    const queryString = requestUrl.search;
    
    // Extract the target URL more carefully to preserve all query parameters
    // First, find the position of "?url=" in the query string
    const urlParamPos = queryString.indexOf("?url=");
    
    // If "?url=" is not found, try looking for "&url="
    const urlParam = urlParamPos >= 0 
      ? queryString.substring(urlParamPos + 5) // Length of "?url=" is 5
      : requestUrl.searchParams.get("url"); // Fallback to the old method
    
    // If no URL is provided, return an error response
    if (!urlParam) {
      return new Response("Missing 'url' parameter. Usage: https://edl-proxy.gabriel-briffe.workers.dev/?url=https://www.edl-soaring.com/mbtiles/extract_mbtiles_from_date.php?fdate=2025-03-27+00:00:00&isobare=90000", {
        status: 400,
        headers: { "Content-Type": "text/plain" }
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
          headers: { "Content-Type": "text/plain" }
        });
      }
  
      // Return the fetched content with CORS headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
          "Access-Control-Allow-Origin": "*", // Allow any origin to access this
          "Content-Disposition": response.headers.get("Content-Disposition") || "attachment" // Preserve filename if provided
        }
      });
    } catch (error) {
      return new Response(`Error fetching ${url}: ${error.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }