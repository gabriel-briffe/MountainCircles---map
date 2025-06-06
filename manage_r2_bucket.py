#!/usr/bin/env python3
"""
Manage Cloudflare R2 bucket - Upload and Delete operations using boto3 S3-compatible API
This script uses the proven approach that successfully uploads files visible in the dashboard
"""

import boto3
import os
import argparse
from pathlib import Path
from botocore.config import Config

def load_credentials():
    """Load R2 credentials from config file"""
    credentials = {}
    config_file = 'r2_credentials.conf'
    
    if not os.path.exists(config_file):
        print(f"❌ Credentials file not found: {config_file}")
        exit(1)
    
    with open(config_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    credentials[key.strip()] = value.strip()
    
    return credentials

def get_s3_client(creds):
    """Create S3 client for R2"""
    endpoint_url = creds['R2_ENDPOINT']
    if endpoint_url.endswith('/' + creds['BUCKET_NAME']):
        base_endpoint = endpoint_url[:-len('/' + creds['BUCKET_NAME'])]
    else:
        base_endpoint = endpoint_url
    
    return boto3.client(
        's3',
        endpoint_url=base_endpoint,
        aws_access_key_id=creds['ACCESS_KEY_ID'],
        aws_secret_access_key=creds['SECRET_ACCESS_KEY'],
        config=Config(
            region_name='auto',
            s3={'addressing_style': 'path'}
        )
    )

def should_upload_file(file_path, allowed_extensions=None):
    """Check if a file should be uploaded based on extension and exclusion rules"""
    file_name = os.path.basename(file_path)
    
    # Skip hidden/system files
    excluded_files = {'.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'}
    if file_name in excluded_files:
        return False
    
    # Check file extension if specified
    if allowed_extensions:
        file_ext = Path(file_path).suffix.lower()
        if file_ext.startswith('.'):
            file_ext = file_ext[1:]  # Remove the dot
        return file_ext in allowed_extensions
    
    return True

def delete_folder(folder_prefix):
    """Delete a folder and all its contents from R2 bucket"""
    creds = load_credentials()
    s3_client = get_s3_client(creds)
    
    # Ensure prefix ends with slash for folder deletion
    if folder_prefix and not folder_prefix.endswith('/'):
        folder_prefix += '/'
    
    print(f"🔍 Bucket: {creds['BUCKET_NAME']}")
    print(f"🗑️  Deleting folder: {folder_prefix}")
    print()
    
    try:
        # List all objects with the given prefix
        response = s3_client.list_objects_v2(
            Bucket=creds['BUCKET_NAME'],
            Prefix=folder_prefix
        )
        
        if 'Contents' not in response or not response['Contents']:
            print(f"❌ No objects found with prefix: {folder_prefix}")
            return False
        
        objects_to_delete = response['Contents']
        print(f"📋 Found {len(objects_to_delete)} objects to delete")
        
        # Show some examples
        print("📄 Sample objects that will be deleted:")
        for i, obj in enumerate(objects_to_delete[:5]):
            print(f"   {obj['Key']}")
        if len(objects_to_delete) > 5:
            print(f"   ... and {len(objects_to_delete) - 5} more objects")
        
        print()
        
        # Ask for confirmation
        response = input("⚠️  Are you sure you want to delete these objects? (y/N): ").strip().lower()
        if response != 'y':
            print("Delete operation cancelled.")
            return False
        
        # Delete objects in batches (S3 allows max 1000 per batch)
        batch_size = 1000
        successful = 0
        failed = 0
        
        for i in range(0, len(objects_to_delete), batch_size):
            batch = objects_to_delete[i:i + batch_size]
            
            # Prepare delete request
            delete_request = {
                'Objects': [{'Key': obj['Key']} for obj in batch]
            }
            
            try:
                print(f"🗑️  Deleting batch {i//batch_size + 1} ({len(batch)} objects)...")
                response = s3_client.delete_objects(
                    Bucket=creds['BUCKET_NAME'],
                    Delete=delete_request
                )
                
                # Check for successful deletions
                if 'Deleted' in response:
                    batch_successful = len(response['Deleted'])
                    successful += batch_successful
                    print(f"✅ Successfully deleted {batch_successful} objects in this batch")
                
                # Check for errors
                if 'Errors' in response:
                    batch_failed = len(response['Errors'])
                    failed += batch_failed
                    print(f"❌ Failed to delete {batch_failed} objects in this batch")
                    for error in response['Errors']:
                        print(f"   Error: {error['Key']} - {error['Message']}")
                        
            except Exception as e:
                print(f"❌ Delete batch failed: {e}")
                failed += len(batch)
        
        print(f"\n📊 Delete Summary:")
        print(f"   ✅ Successfully deleted: {successful}")
        if failed > 0:
            print(f"   ❌ Failed to delete: {failed}")
        print(f"   📁 Total attempted: {len(objects_to_delete)}")
        
        return successful > 0
        
    except Exception as e:
        print(f"❌ Error listing objects: {e}")
        return False

def upload_folder(source_directory, r2_prefix="", allowed_extensions=None):
    """Upload a folder to R2 with folder structure preserved"""
    creds = load_credentials()
    s3_client = get_s3_client(creds)
    
    source_path = Path(source_directory)
    if not source_path.exists():
        print(f"❌ Source directory not found: {source_directory}")
        return False
    
    print(f"🔍 Bucket: {creds['BUCKET_NAME']}")
    print(f"📂 Source: {source_directory}")
    print(f"📝 R2 Prefix: {r2_prefix or '(root)'}")
    if allowed_extensions:
        print(f"🔍 Extensions: {', '.join(sorted(allowed_extensions))}")
    print()
    
    # Find all files to upload
    files_to_upload = []
    skipped_files = []
    
    for file_path in source_path.rglob('*'):
        if file_path.is_file():
            if should_upload_file(str(file_path), allowed_extensions):
                # Calculate relative path for R2 key
                relative_path = file_path.relative_to(source_path)
                r2_key = str(relative_path).replace('\\', '/')  # Ensure forward slashes
                if r2_prefix:
                    r2_key = f"{r2_prefix.strip('/')}/{r2_key}"
                
                files_to_upload.append((str(file_path), r2_key))
            else:
                skipped_files.append(str(file_path))
    
    if not files_to_upload:
        print("❌ No files found to upload after filtering")
        return False
    
    print(f"📋 Found {len(files_to_upload)} files to upload")
    if skipped_files:
        print(f"⏭️  Skipped {len(skipped_files)} files (excluded types/extensions)")
    
    # Show some examples
    print("📄 Sample files that will be uploaded:")
    for i, (local_path, r2_key) in enumerate(files_to_upload[:5]):
        print(f"   {Path(local_path).name} → {r2_key}")
    if len(files_to_upload) > 5:
        print(f"   ... and {len(files_to_upload) - 5} more files")
    
    if skipped_files and len(skipped_files) <= 10:
        print(f"\n⏭️  Skipped files:")
        for skipped in skipped_files[:5]:
            print(f"   {Path(skipped).name}")
        if len(skipped_files) > 5:
            print(f"   ... and {len(skipped_files) - 5} more skipped files")
    
    print()
    
    # Ask for confirmation
    response = input("Continue with upload? (y/N): ").strip().lower()
    if response != 'y':
        print("Upload cancelled.")
        return False
    
    # Upload files
    successful = 0
    failed = 0
    
    for local_path, r2_key in files_to_upload:
        try:
            print(f"📤 Uploading {Path(local_path).name} → {r2_key}")
            
            # Determine content type
            content_type = 'application/octet-stream'  # Default
            if local_path.endswith('.geojson'):
                content_type = 'application/json'
            elif local_path.endswith('.json'):
                content_type = 'application/json'
            elif local_path.endswith('.txt'):
                content_type = 'text/plain'
            
            # Upload the file
            with open(local_path, 'rb') as f:
                s3_client.upload_fileobj(
                    f,
                    creds['BUCKET_NAME'],
                    r2_key,
                    ExtraArgs={
                        'ContentType': content_type,
                        'Metadata': {
                            'uploaded-via': 'boto3-s3-api',
                            'source-script': 'manage_r2_bucket.py'
                        }
                    }
                )
            
            print(f"✅ Successfully uploaded: {r2_key}")
            successful += 1
            
        except Exception as e:
            print(f"❌ Upload failed for {local_path}: {e}")
            failed += 1
    
    print(f"\n📊 Upload Summary:")
    print(f"   ✅ Successful: {successful}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📁 Total attempted: {len(files_to_upload)}")
    if skipped_files:
        print(f"   ⏭️  Skipped: {len(skipped_files)}")
    
    return successful > 0

def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description='Manage Cloudflare R2 bucket - Upload and Delete operations using boto3 S3 API',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Upload:
    %(prog)s --upload ./alpes alpes --extension geojson
    %(prog)s --upload ./norway_data norway --extension geojson
    %(prog)s --upload ./data_folder data --extension geojson --extension json
  
  Delete:
    %(prog)s --delete alpes/
    %(prog)s --delete norway/
    %(prog)s --delete test_folder/
        """)
    
    # Main action group (upload or delete)
    action_group = parser.add_mutually_exclusive_group(required=True)
    action_group.add_argument('--upload', action='store_true', help='Upload files to R2 bucket')
    action_group.add_argument('--delete', type=str, help='Delete folder from R2 bucket (e.g., --delete alpes/)')
    
    # Upload arguments
    parser.add_argument('source_directory', nargs='?', help='Source directory to upload (required for --upload)')
    parser.add_argument('r2_prefix', nargs='?', default='', help='R2 prefix/folder (optional for --upload)')
    parser.add_argument('--extension', '-e', action='append', dest='extensions',
                       help='File extensions to upload (can be used multiple times, only for --upload)')
    
    args = parser.parse_args()
    
    print("🚀 Cloudflare R2 Bucket Management Tool (boto3)")
    print("=" * 50)
    
    if args.upload:
        # Upload mode
        if not args.source_directory:
            print("❌ Error: source_directory is required for upload operation")
            parser.print_help()
            return
        
        # Convert extensions to lowercase
        allowed_extensions = None
        if args.extensions:
            allowed_extensions = set()
            for ext in args.extensions:
                ext = ext.lower()
                if ext.startswith('.'):
                    ext = ext[1:]
                allowed_extensions.add(ext)
        
        success = upload_folder(args.source_directory, args.r2_prefix, allowed_extensions)
        
        if success:
            print("\n🎯 Upload completed! Files should be visible in your Cloudflare dashboard.")
        else:
            print("\n❌ Upload failed or was cancelled.")
    
    elif args.delete:
        # Delete mode
        success = delete_folder(args.delete)
        
        if success:
            print("\n🎯 Delete completed! Objects have been removed from your bucket.")
        else:
            print("\n❌ Delete failed or was cancelled.")

if __name__ == "__main__":
    main() 