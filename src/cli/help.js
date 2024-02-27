import metadata from "../../metadata.js";

export function help(args) {
    console.log(`${metadata.name} ${metadata.version}
  
  A cli tool for recursive web asset crawling and analysis.
  
  Usage:
    main.js <target_url> [options]
  
  Options:
    --delay <milliseconds>  Delay between fetches (default: ${args.delay}ms)
    −−output <directory>    Output directory (default:"./output/<timestamp>")
    --mime-filter "<mimes>" Comma-separated list of allowed MIME types
    --user-agent <name>     User agent string to use; (none, chrome, ..., default: ${args["user-agent"]})
    --ignore-robots         Ignore all directives of robots.txt
    --exclude-urls          Ignore asset urls matching a specific regex
    --include-urls          Only process asset urls matching a specific regex
    --diff <file1> <file2>  Compare to reports to find changes
  
    --verbose               Enable verbose logging
    --report-only           Generates the report without storing assets
    
    --help                  Displays this help message
  `);
}
