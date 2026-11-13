// File: scripts/deploy.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function executeCommand(command, options = {}) {
    try {
        console.log(`Executing: ${command}`);
        return execSync(command, { stdio: options.silent ? 'pipe' : 'inherit', encoding: 'utf8' });
    } catch (error) {
        console.error(`Failed to execute command: ${command}`);
        throw error;
    }
}

async function deploy(instance) {
    console.log(`Starting unified deployment for instance: ${instance || 'default'}`);

    try {
        // 1. Build backend Lambda function
        console.log('\n🔨 Building Lambda function...');
        process.chdir(path.join(__dirname, '../lambda'));
        executeCommand('npm install');

        // 2. Deploy initial CDK stack to get outputs
        console.log('\n🚀 Deploying initial CDK stack...');
        process.chdir(path.join(__dirname, '..'));
        executeCommand('npm install');
        
        // Modify the CDK deploy command to include the instance parameter
        const cdkCommand = instance 
            ? `npx cdk deploy -c instance=${instance} --outputs-file outputs.json --require-approval never`
            : 'npx cdk deploy --outputs-file outputs.json --require-approval never';
        
        executeCommand(cdkCommand);
        
        // Read outputs file
        const outputsPath = path.join(__dirname, '../outputs.json');
        const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));
        
        // Use the correct stack name based on the instance
        const stackName = instance ? `SpApiOauthStack-${instance}` : 'SpApiOauthStack';
        const stackOutputs = outputs[stackName];

        const apiEndpoint = stackOutputs.ApiEndpoint;
        const websiteUrl = stackOutputs.WebsiteUrl;
        const bucketName = stackOutputs.WebsiteBucketName;

        // 3. Update frontend with API endpoint
        console.log('\n📝 Updating frontend configuration...');
        const frontendDir = path.join(__dirname, '../frontend');
        const frontendTemplate = path.join(frontendDir, 'index.html.template');
        const frontendOutput = path.join(frontendDir, 'index.html');
        
        if (!fs.existsSync(frontendDir)) {
            fs.mkdirSync(frontendDir, { recursive: true });
        }

        if (!fs.existsSync(frontendTemplate)) {
            throw new Error('Frontend template file not found: ' + frontendTemplate);
        }

        let htmlContent = fs.readFileSync(frontendTemplate, 'utf8');
        htmlContent = htmlContent.replace('${API_ENDPOINT}', apiEndpoint);
        fs.writeFileSync(frontendOutput, htmlContent);

        // 4. Upload updated frontend to S3
        console.log('\n📤 Uploading frontend to S3...');
        executeCommand(`aws s3 cp ${frontendOutput} s3://${bucketName}/index.html`);

        // 5. Invalidate CloudFront cache
        console.log('\n🔄 Invalidating CloudFront cache...');
        try {
            const distributionId = stackOutputs.WebsiteDistributionId;
            if (distributionId) {
                const invalidationResult = executeCommand(
                    `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*"`,
                    { silent: true }
                );
                console.log('Cache invalidation initiated');
            }
        } catch (error) {
            console.warn('Warning: Failed to invalidate CloudFront cache:', error.message);
        }

        // Cleanup
        if (fs.existsSync(outputsPath)) {
            fs.unlinkSync(outputsPath);
        }

        console.log('\n✅ Deployment completed successfully!');
        console.log(`\nWebsite URL: ${websiteUrl}`);
        console.log(`API Endpoint: ${apiEndpoint}`);
        console.log('\nNote: CloudFront cache invalidation may take a few minutes to complete.');

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

// Get the instance name from command line arguments
const instance = process.argv[2];

deploy(instance).catch(error => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
});
