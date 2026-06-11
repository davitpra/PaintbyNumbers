import { Random } from "../random";

export class Vector {

    public tag:any;
    
    constructor(public values: number[], public weight: number = 1) { }

    public distanceTo(p: Vector): number {
        let sumSquares = 0;
        for (let i: number = 0; i < this.values.length; i++) {
            sumSquares += (p.values[i] - this.values[i]) * (p.values[i] - this.values[i]);
        }

        return Math.sqrt(sumSquares);
    }

    /**
     *  Calculates the weighted average of the given points
     */
    public static average(pts: Vector[]): Vector {
        if (pts.length === 0) {
            throw Error("Can't average 0 elements");
        }

        const dims = pts[0].values.length;
        const values = [];
        for (let i: number = 0; i < dims; i++) {
            values.push(0);
        }

        let weightSum = 0;
        for (const p of pts) {
            weightSum += p.weight;

            for (let i: number = 0; i < dims; i++) {
                values[i] += p.weight * p.values[i];
            }
        }

        for (let i: number = 0; i < values.length; i++) {
            values[i] /= weightSum;
        }

        return new Vector(values);
    }
}

export class KMeans {

    public currentIteration: number = 0;
    public pointsPerCategory: Vector[][] = [];

    public centroids: Vector[] = [];
    public currentDeltaDistanceDifference: number = 0;

    constructor(private points: Vector[], public k: number, private random:Random, centroids: Vector[] | null = null) {

        if (centroids != null) {
            this.centroids = centroids;
            for (let i: number = 0; i < this.k; i++) {
                this.pointsPerCategory.push([]);
            }
        } else {
            this.initCentroids();
        }
    }

    private initCentroids() {
        // k-means++: spread the initial centroids out by sampling each next
        // centroid with probability proportional to weight * D², where D is the
        // distance to the nearest already chosen centroid. Deterministic via the
        // injected seeded Random. Points are unique colors weighted by pixel
        // frequency, so the weighting avoids over-favoring rare noise colors.
        this.centroids.push(this.points[Math.floor(this.points.length * this.random.next())]);
        this.pointsPerCategory.push([]);

        const minDistSq: number[] = new Array(this.points.length).fill(Number.MAX_VALUE);

        for (let c: number = 1; c < this.k; c++) {
            const lastCentroid = this.centroids[this.centroids.length - 1];

            let total = 0;
            for (let i: number = 0; i < this.points.length; i++) {
                const d = this.points[i].distanceTo(lastCentroid);
                const dsq = d * d;
                if (dsq < minDistSq[i]) { minDistSq[i] = dsq; }
                total += this.points[i].weight * minDistSq[i];
            }

            let chosen: number;
            if (total <= 0) {
                // degenerate case: all points coincide with existing centroids
                chosen = Math.floor(this.points.length * this.random.next());
            } else {
                let r = this.random.next() * total;
                chosen = this.points.length - 1; // fallback for fp rounding
                for (let i: number = 0; i < this.points.length; i++) {
                    r -= this.points[i].weight * minDistSq[i];
                    if (r <= 0) {
                        chosen = i;
                        break;
                    }
                }
            }
            this.centroids.push(this.points[chosen]);
            this.pointsPerCategory.push([]);
        }
    }

    public step() {
        // clear category
        for (let i: number = 0; i < this.k; i++) {
            this.pointsPerCategory[i] = [];
        }

        // calculate points per centroid
        for (const p of this.points) {
            let minDist = Number.MAX_VALUE;
            let centroidIndex: number = -1;
            for (let k: number = 0; k < this.k; k++) {
                const dist = this.centroids[k].distanceTo(p);
                if (dist < minDist) {
                    centroidIndex = k;
                    minDist = dist;

                }
            }
            this.pointsPerCategory[centroidIndex].push(p);
        }

        let totalDistanceDiff = 0;

        // adjust centroids
        for (let k: number = 0; k < this.pointsPerCategory.length; k++) {
            const cat = this.pointsPerCategory[k];
            if (cat.length > 0) {
                const avg = Vector.average(cat);

                const dist = this.centroids[k].distanceTo(avg);
                totalDistanceDiff += dist;
                this.centroids[k] = avg;
            }
        }
        this.currentDeltaDistanceDifference = totalDistanceDiff;

        this.currentIteration++;
    }
}
