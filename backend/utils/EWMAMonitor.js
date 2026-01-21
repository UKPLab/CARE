//Helper class for tracking the moving average of the transaction times and logging those that are too slow 
class EWMAMonitor {
    constructor(windowSize = 30, logger) {
        this.alpha = 2 / (windowSize + 1);
        this.mean = null;
        this.variance = 0;
        this.initialized = false;
        this.sampleCount = 0;
        this.logger = logger;
        this.startTime = null;
    }
    start(){
        this.startTime = performance.now();
    }
    finish(success = false){
        if (!this.startTime){
            throw new Error("Start Time does not exist. Have you started the Transaction Monitoring?");
        }
        const duration = performance.now() - this.startTime; 
        const {mean, stdDev} = this.getStats();
        // only check after some warmup for the moving average
        if (this.sampleCount > 30) {
            // 2 standard deviations (95.4% confidence interval)
            const threshold = mean + (2 * stdDev);
            if (duration > threshold) {
                if (success){
                    this.logger.debug(`Transaction ${eventName} succeeded in: ${duration.toFixed(2)}ms which is  slower than expected: < ${threshold.toFixed(2)}ms `);
                } else{
                    this.logger.debug(`Transaction ${eventName} failed and rolled back in: ${duration.toFixed(2)}ms which is  slower than expected: < ${threshold.toFixed(2)}ms `);
                }
               
            }
        }
        this.update(duration);
    }
    update(duration) {
        if (!this.initialized) {
            this.mean = duration;
            this.initialized = true;
            this.sampleCount = 1;
            return;
        }

        // 1. Calculate the residual (error from mean)
        const diff = duration - this.mean;
        
        // 2. Update Mean: mean = mean + alpha * (new_value - mean)
        this.mean += this.alpha * diff;

        // 3. Update Variance: Var = (1 - alpha) * (Var + alpha * diff^2)
        // This is a common recursive estimation for variance
        this.variance = (1 - this.alpha) * (this.variance + this.alpha * Math.pow(diff, 2));
        
        this.sampleCount++;
        if (this.logger && this.sampleCount % 50 === 0){
            this.logger.debug(`Average Transaction finish time: ${this.mean.toFixed(2)}ms with standard Deviation: ${Math.sqrt(this.variance).toFixed(2)}ms at ${this.sampleCount} total Transactions`);
        }
    }

    getStats() {
        return {
            mean: this.mean,
            stdDev: Math.sqrt(this.variance)
        };
    }
}
module.exports ={
    EWMAMonitor,
};