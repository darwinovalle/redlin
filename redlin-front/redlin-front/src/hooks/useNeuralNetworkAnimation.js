import { useEffect } from 'react';
import { gsap } from 'gsap';

export const useNeuralNetworkAnimation = (containerRef) => {
    useEffect(() => {
        const neuralNetwork = containerRef.current;
        if (!neuralNetwork) return;

        const nodes = [];
        const nodeCount = 20;
        const connectionCount = 30;

        // Clear previous elements
        while (neuralNetwork.firstChild) {
            neuralNetwork.removeChild(neuralNetwork.firstChild);
        }

        // Create nodes
        for (let i = 0; i < nodeCount; i++) {
            const node = document.createElement('div');
            node.className = 'node';
            node.style.left = `${Math.random() * 100}%`;
            node.style.top = `${Math.random() * 100}%`;
            node.style.opacity = Math.random() * 0.8 + 0.2;
            node.style.transform = `scale(${Math.random() * 0.5 + 0.5})`;
            neuralNetwork.appendChild(node);
            nodes.push(node);
        }

        // Create connections
        const neuralRect = neuralNetwork.getBoundingClientRect();
        for (let i = 0; i < connectionCount; i++) {
            const connection = document.createElement('div');
            connection.className = 'connection';

            const startNode = nodes[Math.floor(Math.random() * nodes.length)];
            const endNode = nodes[Math.floor(Math.random() * nodes.length)];

            if (startNode === endNode) continue;

            const startRect = startNode.getBoundingClientRect();
            const endRect = endNode.getBoundingClientRect();

            const startX = startRect.left - neuralRect.left + startRect.width / 2;
            const startY = startRect.top - neuralRect.top + startRect.height / 2;
            const endX = endRect.left - neuralRect.left + endRect.width / 2;
            const endY = endRect.top - neuralRect.top + endRect.height / 2;

            const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

            connection.style.width = `${length}px`;
            connection.style.left = `${startX}px`;
            connection.style.top = `${startY}px`;
            connection.style.transform = `rotate(${angle}deg)`;

            neuralNetwork.appendChild(connection);
        }

        // Floating animation for nodes
        gsap.utils.toArray(nodes).forEach(node => {
            gsap.to(node, {
                x: `random(-15, 15)`,
                y: `random(-15, 15)`,
                repeat: -1,
                yoyo: true,
                duration: `random(3, 5)`,
                ease: 'sine.inOut'
            });
        });

    }, [containerRef]);
};
