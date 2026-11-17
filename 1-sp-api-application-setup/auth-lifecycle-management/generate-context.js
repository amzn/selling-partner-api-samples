const fs = require('fs').promises;
const path = require('path');
const ignore = require('ignore');
const fg = require('fast-glob');

// Common patterns to exclude
const DEFAULT_EXCLUDES = [
    // Build and output
    'dist/**',
    'build/**',
    'out/**',
    '*.min.js',
    '*.min.css',
    '*.map',
    'coverage/**',
    'generate-context.js',
    'llm-context.txt',

    // Dependencies and locks
    'node_modules/**',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'tests/**',

    // Binary and media
    '*.png',
    '*.jpg',
    '*.gif',
    '*.ico',
    '*.pdf',
    '*.ttf',
    '*.woff',
    '*.woff2',
    '*.eot',
    
    // Cache and temp
    '.cache/**',
    '.tmp/**',
    '*.log',
    '.DS_Store',
    'thumbs.db',

    // IDE and editor
    '.idea/**',
    '.vscode/**',
    '*.sublime-*',
    '.editorconfig',

    // Environment and local config
    '.env*',
    '*.local',
    'config.local.js',

    // Git
    '.git/**',
    '.gitattributes',

    // Optional test exclusions (comment out if you need tests)
    '__tests__/**',
    'test/**',
    'tests/**',
    '*.test.js',
    '*.spec.js',
    
    // Other common excludes
    '.husky/**',
    '.github/**',
    'cdk.out/**'
];

async function generateProjectStructure(files) {
    files.sort();
    const tree = {};
    for (const file of files) {
        const parts = file.split('/');
        let current = tree;
        for (const part of parts) {
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
    }

    function printTree(node, prefix = '', isLast = true, structure = '') {
        const entries = Object.entries(node);
        if (entries.length === 0) return structure;

        for (const [i, [name, children]] of entries.entries()) {
            const isLastEntry = i === entries.length - 1;
            const line = `${prefix}${isLastEntry ? '└── ' : '├── '}${name}\n`;
            structure += line;
            
            if (Object.keys(children).length > 0) {
                const newPrefix = prefix + (isLastEntry ? '    ' : '│   ');
                structure = printTree(children, newPrefix, isLastEntry, structure);
            }
        }
        return structure;
    }

    return printTree(tree);
}

async function gatherContext() {
    try {
        // Combine .gitignore with default excludes
        let ig = ignore().add(DEFAULT_EXCLUDES);
        try {
            const gitignore = await fs.readFile('.gitignore', 'utf8');
            ig.add(gitignore);
        } catch (e) {
            console.log('No .gitignore found, using default excludes only');
        }

        // Get all files
        const files = await fg(['**/*'], {
            ignore: DEFAULT_EXCLUDES,
            dot: true
        });

        // Additional filtering using ignore patterns
        const includedFiles = files.filter(file => !ig.ignores(file));

        console.log(`Found ${includedFiles.length} files to process`);

        // Generate context
        let contextContent = '';
        
        // Add project structure
        contextContent += '<project_structure>\n';
        contextContent += await generateProjectStructure(includedFiles);
        contextContent += '</project_structure>\n\n';

        // Add file contents
        let totalSize = 0;
        for (const file of includedFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const fileContent = `<file path="${file}">\n${content}\n</file>\n\n`;
                contextContent += fileContent;
                totalSize += fileContent.length;
                console.log(`Processed: ${file} (${fileContent.length} chars)`);
            } catch (error) {
                console.log(`Skipping ${file}: ${error.message}`);
            }
        }

        // Save context file
        await fs.writeFile('llm-context.txt', contextContent);
        console.log(`\nContext file saved as llm-context.txt`);
        console.log(`Total size: ${totalSize} characters`);
        console.log(`Estimated tokens: ~${Math.ceil(totalSize / 4)} (rough estimate)`);

    } catch (error) {
        console.error('Error gathering context:', error);
    }
}

// Install dependencies if needed
const { execSync } = require('child_process');
try {
    require.resolve('ignore');
    require.resolve('fast-glob');
} catch (e) {
    console.log('Installing required dependencies...');
    execSync('npm install ignore fast-glob');
    console.log('Dependencies installed successfully.');
}

// Run the script
gatherContext().catch(error => {
    console.error('Failed to gather context:', error);
});