import { execa } from 'execa'

// Get the commit message from the command line arguments
const commitMessage = process.argv[2] ?? 'initial'

async function runGitCommands() {
	try {
		// Add all changes
		await execa('git', ['add', '.'])
		console.log('Staged all changes.')

		// Commit with the provided message
		await execa('git', ['commit', '-m', commitMessage])
		console.log(`Committed with message: "${commitMessage}"`)

		// Push to the main branch
		await execa('git', ['push', '-u', 'origin', 'main'])
		console.log('Pushed to origin main.')

		// Remove the specified file
		await execa('rm', ['-f', './other/cache.db'])
		console.log('Removed ./other/cache.db')
	} catch (error) {
		console.error('Error executing commands:', error)
		process.exit(1)
	}
}

runGitCommands()
