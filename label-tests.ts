/**
 * LabelStore Test Cases
 * 
 */
import { main as testClear } from './test/label-clear';
import { main as testMany } from './test/label-many-cats';
import { main as testSubtle } from './test/label-subtle';
import { main as testRealistic } from './test/label-realistic';

/**
 * Main function to run all test cases
 */
async function main(): Promise<void> {
    console.log('🎓 Label Test Suite');
    console.log('========================\n');
    
    try {
        await testClear();
        
        await testMany();
        
        await testSubtle();
        
        await testRealistic();
        console.log('\n🎉 All test cases completed successfully!');
        
    } catch (error) {
        console.error('❌ Test error:', (error as Error).message);
        process.exit(1);
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    main();
}
