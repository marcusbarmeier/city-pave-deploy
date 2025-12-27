/**
 * Marketplace AI Agent
 * Handles smart matching, dynamic bidding logic, and communication bridge simulations.
 */

export class MarketplaceAgent {
    constructor() {
        this.subcontractors = this.loadSubcontractors();
        this.jobs = this.loadJobs();
    }

    // Mock data loader - in real app, this would fetch from Firestore
    loadSubcontractors() {
        return [
            {
                id: 'sc_1',
                name: 'Elite Paving Co.',
                location: 'Downtown',
                rating: 4.8,
                skills: ['paving', 'sealcoating'],
                verified: true,
                avatar: 'https://ui-avatars.com/api/?name=Elite+Paving&background=0D8ABC&color=fff'
            },
            {
                id: 'sc_2',
                name: 'Quick Excavation',
                location: 'Northside',
                rating: 4.5,
                skills: ['excavation', 'hauling'],
                verified: true,
                avatar: 'https://ui-avatars.com/api/?name=Quick+Ex&background=EA580C&color=fff'
            },
            {
                id: 'sc_3',
                name: 'Reliable Concrete',
                location: 'West End',
                rating: 4.2,
                skills: ['concrete', 'curbing'],
                verified: false, // New/Pending
                avatar: 'https://ui-avatars.com/api/?name=Reliable+C&background=65A30D&color=fff'
            }
        ];
    }

    loadJobs() {
        // Mock active jobs
        return [
            {
                id: 'job_101',
                title: 'Commercial Lot Sealcoat',
                location: 'Downtown',
                status: 'open',
                bids: 2,
                requiredSkills: ['sealcoating'],
                deadline: new Date(Date.now() + 86400000 * 2) // 2 days
            },
            {
                id: 'job_102',
                title: 'Driveway Excavation',
                location: 'Northside',
                status: 'open',
                bids: 0,
                requiredSkills: ['excavation'],
                deadline: new Date(Date.now() + 86400000 * 5)
            }
        ];
    }

    /**
     * Smart Matching Algorithm
     * Scores subcontractors based on skill match and location.
     */
    findMatchesForJob(jobRequirements, jobLocation) {
        return this.subcontractors.map(sub => {
            let score = 0;
            const reasons = [];

            // Skill Match
            const skillMatch = sub.skills.some(skill => jobRequirements.includes(skill));
            if (skillMatch) {
                score += 50;
                reasons.push('Has required skills');
            }

            // Location Match (Simple string match for mock)
            if (sub.location === jobLocation) {
                score += 30;
                reasons.push('Located nearby');
            }

            // Rating Boost
            if (sub.rating >= 4.5) {
                score += 20;
                reasons.push('Top Rated');
            }

            if (sub.verified) {
                score += 10;
            }

            return {
                subcontractor: sub,
                matchScore: score, // 0-110
                reasons: reasons
            };
        }).filter(match => match.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);
    }

    /**
     * Dynamic Bidding Logic
     * Calculates urgency and recommends actions.
     */
    analyzeBiddingHealth(job) {
        const timeRemaining = job.deadline - Date.now();
        const hoursRemaining = timeRemaining / (1000 * 60 * 60);

        if (hoursRemaining < 24 && job.bids === 0) {
            return {
                status: 'critical',
                message: 'Urgent: Deadline approaching with no bids. Recommend extending or verifying requirements.',
                action: 'EXTEND_DEADLINE'
            };
        } else if (job.bids > 5) {
            return {
                status: 'healthy',
                message: 'Competitive bidding active.',
                action: 'MONITOR'
            };
        }

        return { status: 'normal', message: 'Bidding window open.', action: 'WAIT' };
    }

    /**
     * Get AI Insights for Dashboard
     */
    getInsights() {
        // Mock generating insights based on current state
        const insights = [];

        // 1. New High Match
        const topSub = this.subcontractors.find(s => s.rating > 4.7);
        if (topSub) {
            insights.push({
                type: 'match',
                title: 'High Quality Match Available',
                description: `${topSub.name} (${topSub.rating}★) is available for recent paving requests.`,
                icon: 'star'
            });
        }

        // 2. Bidding Alert
        const urgentJob = this.jobs.find(j => j.bids === 0);
        if (urgentJob) {
            insights.push({
                type: 'alert',
                title: 'Low Bidding Activity',
                description: `Job "${urgentJob.title}" needs attention. Consider expanding match criteria.`,
                icon: 'warning'
            });
        }

        return insights;
    }
}
