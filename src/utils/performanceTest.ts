/**
 * Performance Monitor Test
 * Quick test to verify performance monitoring is working correctly
 */

import { startPerformanceTracking, endPerformanceTracking, trackPerformance } from './performanceMonitor';

// Test basic performance tracking
export const testPerformanceMonitor = () => {
  console.log('🧪 Testing Performance Monitor...');

  // Test 1: Basic start/end tracking
  startPerformanceTracking('test-operation', { testData: 'basic-test' });
  
  // Simulate some work
  const start = Date.now();
  while (Date.now() - start < 10) {
    // Busy wait for 10ms
  }
  
  endPerformanceTracking('test-operation', { completed: true });

  // Test 2: Track function execution
  trackPerformance('test-function', () => {
    // Simulate work
    const start = Date.now();
    while (Date.now() - start < 5) {
      // Busy wait for 5ms
    }
    return 'test-result';
  }, { functionTest: true });

  console.log('✅ Performance Monitor test completed');
};

// Export for manual testing
if (typeof window !== 'undefined') {
  (window as any).testPerformanceMonitor = testPerformanceMonitor;
}
