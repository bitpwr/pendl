# GTFS Import Memory Issues

## Problem

When importing large GTFS datasets (like Stockholm SL's full transit data), Node.js can run out of heap memory with the error:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

This happens because the original import process loads all GTFS data into memory before writing to the database.

## Solutions

### Solution 1: Increased Heap Size (Default)

The default `gtfs:import` script now runs with increased heap size (4GB):

```bash
npm run gtfs:import
```

This is equivalent to:

```bash
node --max-old-space-size=4096 --env-file=.env ./node_modules/.bin/tsx scripts/import-gtfs.ts
```

**Pros:**

- No code changes needed
- Works for most datasets

**Cons:**

- Still loads all data into memory
- May fail on very large datasets or systems with limited RAM

### Solution 2: Streaming Import (Recommended for Large Datasets)

For extra-large datasets or memory-constrained systems, use the streaming import:

```bash
npm run gtfs:import:streaming
```

This version:

- Processes GTFS files one at a time
- Clears data from memory after each phase
- Shows memory usage during import
- More efficient for datasets with millions of records

**Pros:**

- Much lower memory footprint
- Can handle datasets of any size
- Shows progress and memory usage

**Cons:**

- Slightly slower due to multiple file passes

## Manual Execution

If you need even more control:

```bash
# 8GB heap
node --max-old-space-size=8192 --env-file=.env ./node_modules/.bin/tsx scripts/import-gtfs.ts

# 16GB heap (requires sufficient system RAM)
node --max-old-space-size=16384 --env-file=.env ./node_modules/.bin/tsx scripts/import-gtfs-streaming.ts
```

## Docker Execution

When running in Docker, increase memory limits in your compose file:

```yaml
services:
  app:
    mem_limit: 6g
    environment:
      NODE_OPTIONS: "--max-old-space-size=4096"
```

Or run manually in container:

```bash
docker exec -it pendl-app node --max-old-space-size=4096 /app/node_modules/.bin/tsx /app/scripts/import-gtfs-streaming.ts
```

## Monitoring Memory Usage

The streaming import script shows memory usage during processing:

```
=== Phase 6: Stop Times (streaming) ===
Found 2547123 stop times to import
  Progress: 50000/2547123 | Heap: 1234MB
  Progress: 100000/2547123 | Heap: 1456MB
```

## Troubleshooting

### Still getting OOM errors?

1. **Increase heap size further**: Try 8GB or 16GB
2. **Use streaming import**: Switch to `gtfs:import:streaming`
3. **Check system RAM**: Ensure your system has enough available memory
4. **Close other applications**: Free up system memory
5. **Use production mode**: Set `NODE_ENV=production` to reduce overhead

### Import is very slow?

- The streaming import is slower but more reliable
- Database speed matters - ensure PostgreSQL is tuned properly
- Check disk I/O - use SSD storage if possible
- Consider running on a more powerful machine for initial import

### Docker container killed?

Docker may kill containers that exceed memory limits. Increase the limit:

```bash
docker run --memory=8g --memory-swap=8g ...
```

## Performance Comparison

| Method               | Memory Usage | Speed       | Dataset Size Limit |
| -------------------- | ------------ | ----------- | ------------------ |
| Original (no limit)  | ~2-6GB       | Fast        | Medium datasets    |
| Default (4GB heap)   | ~2-4GB       | Fast        | Most datasets      |
| Streaming (4GB heap) | ~1-2GB       | Medium      | Any size           |
| Streaming (8GB heap) | ~1-3GB       | Medium-Fast | Any size           |

## Recommendations

- **Development/Testing**: Use default `npm run gtfs:import`
- **Production (first time)**: Use `npm run gtfs:import:streaming`
- **CI/CD pipelines**: Use streaming import with memory limits
- **Low-memory systems (<4GB RAM)**: Must use streaming import
