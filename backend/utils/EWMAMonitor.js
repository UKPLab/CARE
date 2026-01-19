//Helper class for tracking the moving average of the transaction times and logging those that are too slow 
class EWMAMonitor {
    constructor(windowSize = 30) {
        this.alpha = 2 / (windowSize + 1);
        this.mean = null;
        this.variance = 0;
        this.initialized = false;
        this.sampleCount = 0;
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