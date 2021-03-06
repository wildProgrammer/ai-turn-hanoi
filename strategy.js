var fs = require('fs')
var process  = require('process')
var R = require("ramda")

function *reverse(arr){
    for(let i=arr.length-1; i>=0; i--)
        yield arr[i];
}

function getRandomOption(options) {
    if(options.length == 1){
        var res = options[0]
        options.splice(0, 1)
        return res
    }

    var r = Math.random()
    var index = Math.trunc(r * options.length-0.0000001)
    // console.log("Random num=" + res)
    var res = options[index]
    options.splice(index, 1);
    return res
}
function getRandomWeightedOption(options) {
    if(options.length == 1){
        return options.pop()
    }
    // priority = 50 + 5 * pos
    var max = R.reduce((acc, pos) => acc + 50 + 10 * pos 
    , 0, R.range(0, options.length) )
    // console.log(max)
    var roll = Math.random() * max
    // console.log(roll)
    var sum = 0
    for(var i = 0; i< options.length-1; i++){
        sum += 50 + 10 * i
        if(sum > roll){
            return options.splice(i, 1)[0]
        }
    }
    // console.log("Random num=" + res)
    return options.pop()
}

function getRandomRollback(maxRollback){
    var r = Math.random()
    return Math.trunc(r * maxRollback - 0.0000000001)
}

var lastBars = 0;
class State{
    constructor(state, movable, bars){
        this.state = state 
        this.movable = movable
        this.children = [] // states that result in changing this state
        this.parent = null
        this._hash = null
        if(bars){
            this.bars = lastBars
            lastBars = bars
        }else{
            this.bars = lastBars
        }
    }

    isCalculated(){
        return this.children.length > 0
    }

    hasChildren(){
        return this.children.length > 0
    }

    // equals(otherState){
    //     // return R.equals(otherState.state, this.state)
    //     for(let i =0; i<Math.max(this.movable, otherState.movable); i++)
    //         if(this.state[i] != otherState.state[i])
    //             return false
    //     return true
    // }
    equals(otherState){
        // console.log(`${otherState.hash()} == ${this.hash()}`)
        return otherState.hash() == this.hash()
    }
    addChild(child){
        this.children.push(child)
        child.setParent(this)
    }

    getChildren(){
        return this.children
    }

    setParent(parent){
        this.parent = parent
    }

    hash(){
        // console.log(this.bars)
        if(this._hash !== null) return this._hash
        this._hash = 0;
        for(let i = 0; i<this.movable; i++){
            // console.log(this._hash)
            this._hash += Math.pow(this.bars+1, i) * (this.state[i]+1)
        }
        return this._hash;
    }

}

class Strategy{
    
    constructor(currentState, bars, finalState){
        this.invalidGuesses = 0;
        this.currentState = new State(currentState, currentState.length, bars)
        this.finalState = new State(finalState, currentState.length, bars)
        this.bars = bars
        // this.stepsCount = 0;
        // this.totalRollback = 0
        // this.rollbackCount = 0
    }


    run(){}

    execute(){

        do{
            this.run()
        }while(!this.isDone())
        console.log("DONE")

    }

    validate(fromIndex, to){ 

        // console.log("fromIndex = " + this.fromIndex)
        
        for(var i=0; i<fromIndex; i++){
            if(this.currentState[i] == this.currentState[fromIndex] || to == this.currentState[i])
                return false
        }
        
        return true;
    } 

    isDone(){
        // console.log(this.currentState.state)
        if(this.currentState.movable == -1) return true
        return this.currentState.equals(this.finalState)
    }

    report(){
        var steps = this.previousStates.map((state) => state.state)
        steps.push(this.currentState.state)
        return{
            stepCount: this.previousStates.length ,
            steps: steps,
            rollsCount: this.rollbackCount,
            rollsAmount: this.totalRollback  
        }
    }

    countMovable(arr, firstUnmovable) {
        // console.log(`countMovable: ${arr} ${firstUnmovable}`)
        for (var i = firstUnmovable - 1; i >= 0; i--)
            if (arr[i] != this.finalState.state[i])
                return i + 1

        return -1;

    }

    existedBefore(state) {
        for (let i = this.previousStates.length - 1; i >= 0; i--) {
            if (state.equals(this.previousStates[i])) {
                return true
            } 
        }
        return false
    }

    generateMoves(state) {
        const upperDiscs = R.repeat(-1, this.bars)
        for (var i = 0; i < state.movable; i++) {
            var bar = state.state[i]
            if (upperDiscs[bar] == -1)
                upperDiscs[bar] = i
        }


        for (var i = 0; i < this.bars; i++) {
            if (upperDiscs[i] != -1)
                for (var j = 0; j < this.bars; j++) {
                    if (upperDiscs[j] == -1 || upperDiscs[i] < upperDiscs[j]) {
                        // console.log(`Move from ${i} to ${j}`)
                        // var arrState = state.state.slice(0)
                        const arrState = R.clone(state.state)
                        arrState[upperDiscs[i]] = j
                        // console.log(arrState)
                        const movable = this.countMovable(arrState, state.movable)
                        const child = new State(arrState, movable)
                        if (child.movable < state.movable) {
                            state.children = [child]
                            child.setParent(state)
                            return state.children
                        }
                        state.addChild(child)
                    }
                }
        }
        // console.log("length:" + state.getChildren().length)
        return state.getChildren() || []
    }
}


var iterations = 0;
class RandomStrategy extends Strategy{
    
    constructor(currentState, bars, finalState){
        super(currentState, bars, finalState)
        this.previousStates = []
        this.totalRollback = 0
        this.rollsCount = 0
    }



    validate(option){
        if (this.currentState.equals(option) || this.existedBefore(option))
            return false

        return true
    }





    rollback(){
        var candidate = this.currentState
        do{
            if(!this.previousStates.length){
                throw "NO MORE STATES TO ROLL BACK"
            }
            if(this.previousStates[this.previousStates.length-1].movable != this.currentState.movable)
                break;
            var candidate = this.previousStates.pop()
        }while(!candidate.hasChildren())
        this.currentState = candidate
        this.afterRollback = true

    }

    smartRollback(){
        this.rollsCount+=1
        console.log("BEFORE ROLLBACK " + this.previousStates.length)
        console.log("LAST ROLLBACK " + this.lastRollback)
        this.rollback()
        if (this.rollsCount % 200 == 0){
            if(this.currentState.state.length == this.currentState.movable){
                var deletedStates = this.previousStates.splice(2)
                this.currentState = deletedStates[0]
                this.totalRollback += deletedStates.length
            }else{
                var advancedStates = R.takeLastWhile(
                    (state)=> state.movable == this.currentState.movable,
                     this.previousStates)
                this.currentState = advancedStates[0]
                this.previousStates.splice(this.previousStates.length - advancedStates.length)
                this.lastRollback = this.previousStates.length
            }
            
            console.log("_______________________BOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOM----------------")
            return;
        }
        else if (this.lastRollback === this.previousStates.length) {
            // console.log("ROLLBACK BUG")
            var maxRoll = Math.max(this.lastRollback / 25, 5)
            var roll = getRandomOption(R.range(1, maxRoll))
            for (var i = 0; i < roll; i++)
                this.rollback()
            this.totalRollback += roll

        }
        this.totalRollback += 1
        this.lastRollback = this.previousStates.length
        // console.log("AFTER ROLLBACK " + this.previousStates.length)
    }

    run(){
            this.generateMoves(this.currentState)

        do{
            if (!this.currentState.hasChildren()){
                this.smartRollback()
                return;
            }
            var chosenChild = getRandomOption(this.currentState.children)
            // console.log("CHOSEN " + chosenChild.state)
        }
        while(!this.validate(chosenChild))
        this.previousStates.push(this.currentState)
        // console.log("OLD STATE " + this.currentState.state)
        this.currentState = chosenChild
        // console.log("NEW STATE " + this.currentState.state)
        // console.log(this.previousStates.map(x => x.state))
        
    }
}

class BFSStrategy extends Strategy{
    constructor(currentState, bars, finalState) {
        super(currentState, bars, finalState)
        this.potentialMoves = this.generateMoves(this.currentState);
        // console.log("INITIAL POTENTIAL: " + this.potentialMoves)
        this.previousStates = [this.currentState, ...this.potentialMoves]
        this.minMovable = this.currentState.movable
    }
    existedBefore(state) {
        for (let i = this.previousStates.length - 1; i >= 0; i--) {
            if (state.hash() === this.previousStates[i]) {
                return true
            }
        }
        return false
    }
    generateMovesClean(state) {
        var children = this.generateMoves(state)
        delete state.children
        return children
    }

    isDone(){
        this.currentState = this.potentialMoves.find((move) => move.movable == -1);
        if (this.currentState) return true;
        // this.currentState = this.potentialMoves.some(move => move.equals(this.finalState))
        // if (this.currentState) return true;
    }

    run(){
        // console.log(this.potentialMoves.length)
        let nextMoves = []
        for(let parent of this.potentialMoves){
            let children = this.generateMovesClean(parent).filter((child) => !this.existedBefore(child))

            for(let child of children)
                if(this.minMovable > child.movable){
                    this.minMovable = child.movable
                    this.potentialMoves = [child]
                    this.previousStates = [child.hash()]
                    console.log("SHORTCUT")
                    return
                }
            this.previousStates = this.previousStates.concat(...children.map((c)=>c.hash()))
            nextMoves = nextMoves.concat(...children)
        }
        this.potentialMoves = nextMoves
    }

    report(){
        let state = this.currentState
        let path = [state]
        console.log("A STATE" + state.parent)
        while(state.parent !== null){
            state = state.parent
            path.push(state)
        }
        return {
            stepCount: path.length,
            steps: path
        }
    }
}


class IDDFSStrategy extends BFSStrategy {
    constructor(){
        super(...arguments);
        this.foundFinalState = false
    }

    run() {
        // console.log(this.potentialMoves.map(move=> {return {state: move.state, moveable: move.moveable}}))
        // console.log(this.potentialMoves.map(v => { return { state: v.state, movable: v.movable } }))
        console.log(this.potentialMoves.length)
        const traversed = R.flatten(R.map((move) => this.deepSearch(move, 1), this.potentialMoves))

        const betterNodes = R.filter((node) => node.obj.movable < this.minMovable, traversed)

        if(betterNodes.length > 0){
            const feval = (node) => node.obj.movable * 10 + node.inverseDepth
            let bestNode = betterNodes[0]
            // console.log(bestNode.obj.state)
            let bestVal = feval(bestNode)
            // console.log("after bestval")
            for (let i = 1; i< betterNodes.length; i++){
                const nodeVal = feval(betterNodes[i])
                // console.log("in loop " + i)
                if(nodeVal > bestVal){
                    bestNode = betterNodes[i]
                    bestVal = nodeVal
                }
            }
            bestNode = bestNode.obj
            this.minMovable = bestNode.minMovable
            this.potentialMoves = [bestNode]
            this.previousStates = []

            return;
        }

        this.potentialMoves = R.filter((node) => node.inverseDepth == 0, traversed).map((v)=>v.obj)
       
    }



    deepSearch(root, steps){
        this.previousStates.push(root.hash())
        var currentNode = [{ obj: root, inverseDepth: steps }]
        if(steps == 0 || this.foundFinalState){
            if(root.movable == -1){
                this.foundFinalState = true
                // console.log("FOUND MOVABLE")
            }
            return currentNode
        }
        const children = this.generateMovesClean(root)

        const traversed = R.map((child)=> this.deepSearch(child, steps-1), children)
        traversed.push(currentNode)
        // console.log(traversed.map(v => v.obj.state))
        return R.flatten(traversed)

    }
}

class HillClimbingStrategy extends Strategy {

    constructor(currentState, bars, finalState){
        super(currentState, bars, finalState)
        this.previousStates = [this.currentState]
        this.failed = false;
    }

    run() {
        var moves = this.generateMoves(this.currentState);
        delete this.currentState.children
        var fitnessList = moves.map((move) => this.calculateFitness(move))        
        for (var i=0; i<fitnessList.length; i++)
            if (fitnessList[i] == -1){
                fitnessList.splice(i, 1);
                moves.splice(i,1)
                i--;
            }

        if(fitnessList.length == 0)
            this.failed = true
        else{
            if(R.all(R.equals(fitnessList[0]), fitnessList)){
                // console.log("randoming")
                // console.log(fitnessList)
                this.currentState = getRandomOption(moves)
            }
            else{
                // console.log("USING MAX FITNESS")
                var maxIndex = 0;
                var maxFitness = fitnessList[0]
                for (let i = 1; i<fitnessList.length; i++){
                    if(fitnessList[i] > maxFitness){
                        maxFitness = fitnessList[i]
                        maxIndex = i
                    }
                }
                this.currentState = moves[maxIndex]
            }

            this.previousStates.push(this.currentState);
        }

    }

    discsOverSource(state){
        const sourceBar = state.state[state.movable-1]
        let discsOver = 0
        for(let i =0; i<state.movable-1; i++)
            if(state.state[i] == sourceBar) 
                discsOver++;
        return discsOver
    }
    discsOnTarget(state){
        const targetBar = this.finalState.state[state.movable-1]
        let discs = 0
        for(let i =0; i<state.movable-1; i++)
            if(state.state[i] == targetBar) 
                discs++;
        return discs
    }

    calculateFitness(state){

        if(this.existedBefore(state))
            return -1;
        const onTarget = this.discsOnTarget(state)
        const overSource = this.discsOverSource(state) 
        if(onTarget + overSource > 0)
            return 1 / (onTarget + overSource * (1 + 1/this.bars))  //default fitness
        return 1
    }

    isDone() {
        // console.log(this.currentState.state)
        if (this.currentState.movable == -1 || this.failed) return true
        return this.currentState.equals(this.finalState)
    }


    report(){
        return {
            steps: this.previousStates,
            failed: this.failed,
            stepsCount: this.previousStates.length
        }
    }


}



module.exports = { 
    RandomStrategy: RandomStrategy,
    State: State,
    getRandomWeightedOption: getRandomWeightedOption,
    BFSStrategy: BFSStrategy, 
    HillClimbingStrategy: HillClimbingStrategy,
    IDDFSStrategy: IDDFSStrategy
}